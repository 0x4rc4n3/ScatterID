import oqs

def sign_data(data: bytes, private_key, algorithm: str = "ML-DSA-65") -> bytes:
    """Sign data using a post-quantum private key securely.

    Args:
        data: Raw bytes to sign.
        private_key: The exported secret key from generate_keypair() — accepts
                     bytes or bytearray. Callers should hold private keys as
                     bytearray so they can be zeroed by kms.zeroize() after use.
        algorithm: The PQC signature algorithm name.

    Returns:
        signature: bytes
    """
    if not isinstance(data, (bytes, bytearray)) or len(data) == 0:
        raise ValueError("Data to sign must be non-empty bytes or bytearray")
    if not isinstance(private_key, (bytes, bytearray)) or len(private_key) == 0:
        raise ValueError("Private key must be non-empty bytes or bytearray")
    if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
        raise ValueError("Unsupported or insecure PQC signature algorithm requested")

    # oqs.Signature accepts bytes; convert bytearray transparently.
    # SECURITY: signer.free() calls OQS_SIG_free() which invokes
    # OQS_MEM_secure_free() on the internal C-level secret key buffer.
    # Without this, the bytes(private_key) copy persists in the C heap
    # until process exit, recoverable from memory dumps / core dumps.
    signer = oqs.Signature(algorithm, secret_key=bytes(private_key))
    try:
        return signer.sign(bytes(data))
    finally:
        signer.free()


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
    if not isinstance(data, (bytes, bytearray)) or len(data) == 0:
        raise ValueError("Original data must be non-empty bytes or bytearray")
    if not isinstance(signature, (bytes, bytearray)) or len(signature) == 0:
        raise ValueError("Signature must be non-empty bytes or bytearray")
    if not isinstance(public_key, (bytes, bytearray)) or len(public_key) == 0:
        raise ValueError("Public key must be non-empty bytes or bytearray")
    if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
        raise ValueError("Unsupported or insecure PQC signature algorithm requested")

    # Must explicitly free the C allocation (OQS_SIG)
    verifier = oqs.Signature(algorithm)
    try:
        return verifier.verify(bytes(data), bytes(signature), bytes(public_key))
    finally:
        verifier.free()
