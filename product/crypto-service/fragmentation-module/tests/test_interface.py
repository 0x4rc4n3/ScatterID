import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import json
import pytest
from keygen import generate_keypair
from interface import package_credential, unpackage_credential


@pytest.fixture
def keypair():
    return generate_keypair()


def test_round_trip_succeeds_with_threshold_shares(keypair):
    public_key, private_key = keypair
    claim = {"student": "Arcane", "degree": "BS Cybersecurity", "year": 2026}

    credential = package_credential(claim, private_key)
    subset = credential["shares"]["shares"][0:3]  # exactly k=3

    recovered_bytes, valid = unpackage_credential(credential, public_key, subset)
    recovered_claim = json.loads(recovered_bytes.decode("utf-8"))

    assert valid is True
    assert recovered_claim == claim


def test_reconstruction_fails_with_insufficient_shares(keypair):
    public_key, private_key = keypair
    claim = {"student": "Arcane", "degree": "BS Cybersecurity", "year": 2026}

    credential = package_credential(claim, private_key)
    insufficient_subset = credential["shares"]["shares"][0:2]  # only k-1

    with pytest.raises(Exception):
        unpackage_credential(credential, public_key, insufficient_subset)


def test_verification_fails_on_tampered_signature(keypair):
    public_key, private_key = keypair
    claim = {"student": "Arcane", "degree": "BS Cybersecurity", "year": 2026}

    credential = package_credential(claim, private_key)
    # Tamper with the signature itself
    tampered_sig = bytearray(bytes.fromhex(credential["signature"]))
    tampered_sig[0] ^= 0xFF  # flip bits in the first byte
    credential["signature"] = tampered_sig.hex()

    subset = credential["shares"]["shares"][0:3]
    _, valid = unpackage_credential(credential, public_key, subset)

    assert valid is False


def test_different_share_combinations_all_reconstruct(keypair):
    public_key, private_key = keypair
    claim = {"student": "Arcane", "degree": "BS Cybersecurity", "year": 2026}

    credential = package_credential(claim, private_key)
    all_shares = credential["shares"]["shares"]

    # Try shares [0,1,2], [1,2,3], [2,3,4] — not just the first 3
    combos = [all_shares[0:3], all_shares[1:4], all_shares[2:5]]
    for combo in combos:
        recovered_bytes, valid = unpackage_credential(credential, public_key, combo)
        recovered_claim = json.loads(recovered_bytes.decode("utf-8"))
        assert valid is True
        assert recovered_claim == claim


def test_invalid_algorithm_raises_error(keypair):
    _, private_key = keypair
    claim = {"student": "Arcane"}

    with pytest.raises(ValueError, match="Unsupported or insecure PQC signature algorithm"):
        package_credential(claim, private_key, algorithm="INVALID-ALG")


def test_invalid_types_raises_error(keypair):
    _, private_key = keypair

    # Passing string instead of dict for claim data
    with pytest.raises(TypeError, match="Claim data must be a dictionary"):
        package_credential("invalid_claim_type", private_key)


def test_invalid_thresholds_raises_error(keypair):
    _, private_key = keypair
    claim = {"student": "Arcane"}

    # k > n
    with pytest.raises(ValueError, match="Threshold k cannot exceed total shards n"):
        package_credential(claim, private_key, n=3, k=5)

    # Negative bounds
    with pytest.raises(ValueError, match="Parameters n and k must be positive integers"):
        package_credential(claim, private_key, n=-3, k=2)
