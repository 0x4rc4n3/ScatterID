from sslib import shamir
import hashlib

def split_secret(secret: bytes, n: int, k: int):
    """Split a secret into n Shamir shares with threshold k securely.

    Returns a JSON-safe dict — all byte values are hex-encoded strings.
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
    hex_data = shamir.to_hex(raw)
    
    import hmac
    import os
    from config import get_config
    
    hmac_key = get_config("security.crypto_service_api_key", os.environ.get("CRYPTO_SERVICE_API_KEY", "")).encode('utf-8')
    
    updated_shares = []
    for share in hex_data["shares"]:
        checksum = hmac.new(hmac_key, share.encode('utf-8'), hashlib.sha256).hexdigest()
        updated_shares.append(f"{share}:{checksum}")
        
    hex_data["shares"] = updated_shares
    return hex_data


def reconstruct_secret(shares_data: dict) -> bytes:
    """Reconstruct a secret from a threshold number of hex-encoded shares.

    Args:
        shares_data: A dict of hex-encoded shares (as produced by split_secret).

    Returns:
        secret: bytes
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
