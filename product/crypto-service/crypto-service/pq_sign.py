import oqs

def sign_data(data: bytes, private_key: bytes, algorithm: str = "ML-DSA-65") -> bytes:
    """Sign data using a post-quantum private key securely.

    Args:
        data: Raw bytes to sign.
        private_key: The exported secret key from generate_keypair().
        algorithm: The PQC signature algorithm name.

    Returns:
        signature: bytes
    """
    if not isinstance(data, bytes) or len(data) == 0:
        raise ValueError("Data to sign must be non-empty bytes")
    if not isinstance(private_key, bytes) or len(private_key) == 0:
        raise ValueError("Private key must be non-empty bytes")
    if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
        raise ValueError("Unsupported or insecure PQC signature algorithm requested")

    signer = oqs.Signature(algorithm, secret_key=private_key)
    return signer.sign(data)


def verify_signature(data: bytes, signature: bytes, public_key: bytes, algorithm: str = "ML-DSA-65") -> bool:
    """Verify a signature against data and a public key securely.

    Args:
        data: The original raw bytes.
        signature: The signature to check.
        public_key: The signer's public key.
        algorithm: The PQC signature algorithm name.

    Returns:
        valid: bool
    """
    if not isinstance(data, bytes) or len(data) == 0:
        raise ValueError("Original data must be non-empty bytes")
    if not isinstance(signature, bytes) or len(signature) == 0:
        raise ValueError("Signature must be non-empty bytes")
    if not isinstance(public_key, bytes) or len(public_key) == 0:
        raise ValueError("Public key must be non-empty bytes")
    if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
        raise ValueError("Unsupported or insecure PQC signature algorithm requested")

    verifier = oqs.Signature(algorithm)
    return verifier.verify(data, signature, public_key)
