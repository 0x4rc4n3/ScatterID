import datetime
from pq_sign import sign_data, verify_signature

def issue_credential(data_hash: str, private_key, public_key_id: str, algorithm: str = "ML-DSA-65"):
    if not isinstance(data_hash, str) or not data_hash:
        raise ValueError("data_hash must be a non-empty string")
    if not isinstance(private_key, (bytes, bytearray)) or len(private_key) == 0:
        raise ValueError("Private key must be non-empty bytes or bytearray")
    if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
        raise ValueError("Unsupported or insecure PQC signature algorithm requested")

    # The data_hash is what we sign directly (as bytes).
    # We expect data_hash to be a hex string of the SHA3-256 hash.
    try:
        hash_bytes = bytes.fromhex(data_hash)
    except ValueError:
        raise ValueError("data_hash must be a valid hex string")

    signature = sign_data(hash_bytes, private_key, algorithm)

    return {
        "dataHash": data_hash,
        "signature": signature.hex(),
        "algorithm": algorithm,
        "publicKeyId": public_key_id,
        "issuedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

def verify_credential(data_hash: str, signature_hex: str, public_key: bytes, algorithm: str = "ML-DSA-65"):
    try:
        hash_bytes = bytes.fromhex(data_hash)
        signature_bytes = bytes.fromhex(signature_hex)
    except ValueError:
        return False

    try:
        return verify_signature(hash_bytes, signature_bytes, public_key, algorithm)
    except Exception:
        return False
