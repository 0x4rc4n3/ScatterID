import hashlib
import json
from datetime import datetime, timezone

from keygen import generate_keypair
from pq_sign import sign_data, verify_signature
from shamir import split_secret, reconstruct_secret


def package_credential(data: dict, private_key: bytes, public_key: bytes = None, n: int = 5, k: int = 3, algorithm: str = "ML-DSA-65"):
    """Hash, sign, and shard a claim into a SignedCredential securely.

    Args:
        data: The claim data (e.g. {"subject": "X", "role": "Y"}).
        private_key: Issuer's PQC private key.
        public_key: Optional Issuer's PQC public key (bytes).
        n: Total number of shares.
        k: Threshold required to reconstruct.
        algorithm: PQC signature algorithm name.

    Returns:
        A dict matching the SignedCredential shape from the
        Interface Contract: data_hash, signature, shares,
        algorithm, created_at, public_key (optional).
    """
    if not isinstance(data, dict):
        raise TypeError("Claim data must be a dictionary")
    if not isinstance(private_key, bytes) or len(private_key) == 0:
        raise ValueError("Private key must be non-empty bytes")
    if public_key is not None and not isinstance(public_key, bytes):
        raise TypeError("Public key must be bytes")
    if not isinstance(n, int) or not isinstance(k, int):
        raise TypeError("Parameters n and k must be integers")
    if k <= 0 or n <= 0:
        raise ValueError("Parameters n and k must be positive integers")
    if k > n:
        raise ValueError("Threshold k cannot exceed total shards n")
    if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
        raise ValueError("Unsupported or insecure PQC signature algorithm requested")

    raw_bytes = json.dumps(data, sort_keys=True).encode("utf-8")
    data_hash = hashlib.sha3_256(raw_bytes).hexdigest()

    signature = sign_data(raw_bytes, private_key, algorithm)
    split = split_secret(raw_bytes, n=n, k=k)

    res = {
        "data_hash": data_hash,
        "signature": signature.hex(),
        "shares": split,
        "algorithm": algorithm,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if public_key:
        res["public_key"] = public_key.hex()
    return res


def unpackage_credential(signed_credential: dict, public_key, shares_subset: list):
    """Verify and reconstruct data from a SignedCredential securely.

    Args:
        signed_credential: The dict produced by package_credential.
        public_key: Issuer's PQC public key (bytes) or list of historical public keys.
        shares_subset: A list of at least k shares to use for
            reconstruction.

    Returns:
        (data: bytes, valid: bool)
    """
    if not isinstance(signed_credential, dict):
        raise TypeError("signed_credential must be a dictionary")
    if not isinstance(shares_subset, list):
        raise TypeError("shares_subset must be a list of strings")

    required_fields = ["shares", "signature", "algorithm"]
    for field in required_fields:
        if field not in signed_credential:
            raise ValueError(f"signed_credential is missing required field: {field}")

    shares_meta = signed_credential["shares"]
    if not isinstance(shares_meta, dict) or "required_shares" not in shares_meta or "prime_mod" not in shares_meta:
        raise ValueError("signed_credential['shares'] is missing SSS metadata")

    reconstruction_input = {
        "required_shares": shares_meta["required_shares"],
        "prime_mod": shares_meta["prime_mod"],
        "shares": shares_subset,
    }
    recovered_bytes = reconstruct_secret(reconstruction_input)

    signature_bytes = bytes.fromhex(signed_credential["signature"])
    algorithm = signed_credential.get("algorithm", "ML-DSA-65")

    keys_to_test = []

    if isinstance(public_key, list):
        for k_item in public_key:
            if not isinstance(k_item, bytes):
                raise TypeError("Historical public key list items must be bytes")
            if k_item not in keys_to_test:
                keys_to_test.append(k_item)
    elif public_key:
        if not isinstance(public_key, bytes):
            raise TypeError("Public key parameter must be bytes")
        if public_key not in keys_to_test:
            keys_to_test.append(public_key)

    valid = False

    for key in keys_to_test:
        try:
            if verify_signature(recovered_bytes, signature_bytes, key, algorithm):
                valid = True
                break
        except Exception:
            continue

    return recovered_bytes, valid
