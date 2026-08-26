from flask import Flask, request, jsonify
from kms import KMS
from interface import package_credential, unpackage_credential
import os
import re
from config import get_config

app = Flask(__name__)

# Initialize KMS
kms = KMS()

# Load keys at startup directly from Vault
PUBLIC_KEY, PRIVATE_KEY = kms.get_keys()

# Load API key for verification from global configuration or environment
API_KEY = get_config("security.crypto_service_api_key", os.environ.get("CRYPTO_SERVICE_API_KEY"))
if not API_KEY:
    raise ValueError(
        "CRITICAL: CRYPTO_SERVICE_API_KEY is not configured. "
        "For security, the crypto-service cannot start without an API key."
    )

@app.before_request
def enforce_api_key():
    """Enforce Authorization: Bearer <API_KEY> for all endpoints."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized: Missing Bearer Token", "code": "UNAUTHORIZED"}), 401
    
    import hmac
    token = auth_header.split(" ")[1]
    if not hmac.compare_digest(token, API_KEY):
        return jsonify({"error": "Unauthorized: Invalid API Key", "code": "UNAUTHORIZED"}), 401


@app.route("/package", methods=["POST"])
def package_route():
    data = request.get_json()
    if not data or "claim" not in data:
        return jsonify({"error": "Missing 'claim' field", "code": "BAD_REQUEST"}), 400

    claim = data["claim"]
    if not isinstance(claim, dict):
        return jsonify({"error": "Invalid parameter: claim must be a JSON object", "code": "INVALID_PARAMETER"}), 400

    subject = claim.get("subject")
    if not subject or not isinstance(subject, str) or len(subject.strip()) == 0:
        return jsonify({"error": "Invalid parameter: claim.subject is required and must be a non-empty string", "code": "INVALID_PARAMETER"}), 400

    # Strict input sanitization to prevent injection
    sanitized_subject = ''.join(c for c in subject if c not in "<>'\"&;").strip()
    if len(sanitized_subject) > 256:
        return jsonify({"error": "Invalid parameter length: claim.subject exceeds 256 characters", "code": "PARAMETER_TOO_LONG"}), 400

    claim["subject"] = sanitized_subject
    if "role" in claim:
        role = claim["role"]
        if not isinstance(role, str):
            return jsonify({"error": "Invalid parameter: claim.role must be a string", "code": "INVALID_PARAMETER"}), 400
        sanitized_role = ''.join(c for c in role if c not in "<>'\"&;").strip()
        if len(sanitized_role) > 256:
            return jsonify({"error": "Invalid parameter length: claim.role exceeds 256 characters", "code": "PARAMETER_TOO_LONG"}), 400
        claim["role"] = sanitized_role

    credential = package_credential(claim, PRIVATE_KEY, public_key=PUBLIC_KEY)
    return jsonify(credential), 201


@app.route("/unpackage", methods=["POST"])
def unpackage_route():
    data = request.get_json()
    if not data or "credential" not in data or "sharesSubset" not in data:
        return jsonify({"error": "Missing 'credential' or 'sharesSubset' field", "code": "BAD_REQUEST"}), 400

    credential = data["credential"]
    shares_subset = data["sharesSubset"]

    if not isinstance(credential, dict) or not isinstance(shares_subset, list):
        return jsonify({"error": "Invalid parameter types: credential must be object, sharesSubset must be array", "code": "INVALID_PARAMETER"}), 400

    # Enforce UUID format for credential ID if present
    cred_id = credential.get("id")
    if cred_id:
        uuid_regex = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.IGNORECASE)
        if not isinstance(cred_id, str) or not uuid_regex.match(cred_id):
            return jsonify({"error": "Invalid parameter: credential.id must be a valid UUID v4", "code": "INVALID_PARAMETER"}), 400

    # Enforce structure for shares via strict regular expression
    share_regex = re.compile(r'^[1-5]-[0-9a-f]+(:[0-9a-f]+)?$', re.IGNORECASE)
    for s in shares_subset:
        if not isinstance(s, str) or not share_regex.match(s):
            return jsonify({"error": "Invalid parameter: shares must be string format index-value:checksum", "code": "INVALID_PARAMETER"}), 400

    try:
        keys_to_use = getattr(kms, 'public_key_history', [PUBLIC_KEY])
        if not keys_to_use:
            keys_to_use = [PUBLIC_KEY]

        recovered_bytes, valid = unpackage_credential(
            credential, keys_to_use, shares_subset
        )
        return jsonify({
            "valid": valid,
            "recoveredData": recovered_bytes.decode("utf-8", errors="replace"),
        }), 200
    except Exception as e:
        app.logger.error("Credential reconstruction failed", exc_info=True)
        return jsonify({"error": "Credential reconstruction failed due to internal error", "code": "RECONSTRUCTION_FAILED"}), 400


@app.route("/rotate", methods=["POST"])
def rotate_route():
    global PUBLIC_KEY, PRIVATE_KEY
    try:
        PUBLIC_KEY, PRIVATE_KEY = kms.rotate_keys()
        return jsonify({
            "message": "Keys rotated successfully",
            "public_key_len": len(PUBLIC_KEY)
        }), 200
    except Exception as e:
        app.logger.error("Key rotation operation failed", exc_info=True)
        return jsonify({"error": "Key rotation operation failed due to internal KMS error", "code": "ROTATION_FAILED"}), 500


import subprocess

def ensure_certificates(cert_path, key_path, base_dir):
    if os.path.exists(cert_path) and os.path.exists(key_path):
        return cert_path, key_path

    certs_dir = os.path.dirname(cert_path)
    os.makedirs(certs_dir, exist_ok=True)
    script_path = os.path.abspath(os.path.join(base_dir, '../certs/generate_certs.sh'))

    if os.path.exists(script_path):
        print(f"Generating TLS certificates via {script_path}...")
        try:
            subprocess.run(['bash', script_path], check=True)
            if os.path.exists(cert_path) and os.path.exists(key_path):
                return cert_path, key_path
        except Exception as err:
            print(f"Warning: Script cert generation failed ({err}), falling back to direct self-signed cert generation.")

    print("Generating self-signed TLS fallback certificates...")
    try:
        subprocess.run([
            'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
            '-out', cert_path, '-keyout', key_path, '-days', '365',
            '-subj', '/CN=localhost/O=ScatterID'
        ], check=True)
    except Exception as err:
        raise FileNotFoundError(
            f"TLS Certificates not found at {cert_path} or {key_path} and automatic generation failed: {err}"
        )

    return cert_path, key_path


if __name__ == "__main__":
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.dirname(BASE_DIR)
    TARGET_CERT = '/app/certs/crypto-service.crt' if os.path.exists('/app/certs') else os.path.join(BASE_DIR, '../certs/crypto-service.crt')
    TARGET_KEY = '/app/certs/crypto-service.key' if os.path.exists('/app/certs') else os.path.join(BASE_DIR, '../certs/crypto-service.key')

    CERT_PATH, KEY_PATH = ensure_certificates(TARGET_CERT, TARGET_KEY, BASE_DIR)
    BUNDLE_PATH = os.path.join(os.path.dirname(CERT_PATH), 'bundle.crt')
    EFFECTIVE_CERT = BUNDLE_PATH if os.path.exists(BUNDLE_PATH) else CERT_PATH

    # Run with HTTPS / SSL context
    app.run(host='0.0.0.0', port=5001, debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true', ssl_context=(EFFECTIVE_CERT, KEY_PATH))

