from sslib import shamir

def split_secret(secret: bytes, n: int, k: int):
    """Split a secret into n Shamir shares with threshold k securely.

    Args:
        secret: The raw secret bytes to split.
        n: Total number of shares to generate.
        k: Minimum shares required to reconstruct.

    Returns:
        A JSON-safe dict (all byte values hex-encoded as strings).
    """
    if not isinstance(secret, bytes) or len(secret) == 0:
        raise ValueError("Secret must be non-empty bytes")
    if not isinstance(n, int) or not isinstance(k, int):
        raise TypeError("Parameters n and k must be integers")
    if k <= 0 or n <= 0:
        raise ValueError("Parameters n and k must be positive integers")
    if k > n:
        raise ValueError("Threshold k cannot be greater than total shards n")

    raw = shamir.split_secret(secret, k, n)
    return shamir.to_hex(raw)


def reconstruct_secret(shares_data: dict) -> bytes:
    """Reconstruct a secret from a threshold number of hex-encoded shares.

    Args:
        shares_data: A dict of hex-encoded shares (as produced by split_secret).

    Returns:
        secret: bytes

    Raises:
        ValueError: If input format validation or threshold checks fail.
        TypeError: If parameter types are invalid.
    """
    if not isinstance(shares_data, dict):
        raise TypeError("Shares data must be a dictionary")
    
    required_fields = ["shares", "required_shares", "prime_mod"]
    for field in required_fields:
        if field not in shares_data:
            raise ValueError(f"Shares data is missing required field: {field}")

    shares = shares_data["shares"]
    required_shares = shares_data["required_shares"]
    prime_mod = shares_data["prime_mod"]

    if not isinstance(shares, list):
        raise TypeError("shares field must be a list")
    if not isinstance(required_shares, int):
        raise TypeError("required_shares field must be an integer")
    if not isinstance(prime_mod, str):
        raise TypeError("prime_mod field must be a string")

    if len(shares) < required_shares:
        raise ValueError(f"Insufficient shares provided: got {len(shares)}, require at least {required_shares}")

    raw = shamir.from_hex(shares_data)
    return shamir.recover_secret(raw)
