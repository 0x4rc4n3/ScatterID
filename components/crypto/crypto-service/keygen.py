import oqs

def generate_keypair(algorithm: str = "ML-DSA-65"):
    """Generate a post-quantum signing keypair securely.

    Args:
        algorithm: The PQC signature algorithm name.

    Returns:
        (public_key: bytes, private_key: bytes)
    """
    if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
        raise ValueError("Unsupported or insecure PQC signature algorithm requested")

    signer = oqs.Signature(algorithm)
    try:
        public_key = signer.generate_keypair()
        private_key = bytearray(signer.export_secret_key())
        return public_key, private_key
    finally:
        signer.free()


if __name__ == "__main__":
    try:
        pub, priv = generate_keypair()
        print(f"Public key length: {len(pub)} bytes")
        print(f"Private key length: {len(priv)} bytes")
    except Exception as e:
        print(f"Key generation failed: {e}")
