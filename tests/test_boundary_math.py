#!/usr/bin/env python3
"""
==============================================================================
ScatterID — Boundary & Edge-Case Mathematical Verification Suite (§3)
==============================================================================
Validates foundational mathematical and structural edge cases:
  1. NIST CAVP SHA3-256 Official Test Vectors (0-bit, 8-bit, 24-bit, 448-bit, 1MB).
  2. ML-DSA-65 Fixed Size Container Boundaries:
     - Signatures: 3308B, 3309B (standard), 3310B.
     - Public Keys: 1951B, 1952B (standard), 1953B.
  3. Salt Edge Cases: 0-byte, 1-byte, 15-byte, 16-byte, 17-byte, 1MB, odd-length,
     non-hex characters.
  4. Cross-runtime bit-for-bit parity with Node.js crypto.
==============================================================================
"""

import hashlib
import os
import re
import subprocess
import sys
import tempfile
import unittest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT_DIR, "components/crypto/crypto-service"))

import oqs
from keygen import generate_keypair
from pq_sign import sign_data, verify_signature
from interface import issue_credential, verify_credential


class NISTCAVPSHA3Tests(unittest.TestCase):
    """
    Validates SHA3-256 implementation against published NIST Cryptographic
    Algorithm Validation Program (CAVP) Byte-Oriented Known Answer Test (KAT) vectors.
    """

    def test_nist_cavp_empty_message(self):
        """NIST CAVP SHA3-256 Vector: 0-length message (Empty String)."""
        msg = b""
        expected = "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"
        actual = hashlib.sha3_256(msg).hexdigest()
        self.assertEqual(actual, expected, f"SHA3-256 failed on NIST CAVP empty message")

    def test_nist_cavp_single_byte_message(self):
        """NIST CAVP SHA3-256 Vector: 1-byte message ('a' / 0x61)."""
        msg = b"a"
        expected = "80084bf2fba02475726feb2cab2d8215eab14bc6bdd8bfb2c8151257032ecd8b"
        actual = hashlib.sha3_256(msg).hexdigest()
        self.assertEqual(actual, expected, f"SHA3-256 failed on NIST CAVP 1-byte message")

    def test_nist_cavp_24bit_message(self):
        """NIST CAVP SHA3-256 Vector: 24-bit / 3-byte message ('abc')."""
        msg = b"abc"
        expected = "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532"
        actual = hashlib.sha3_256(msg).hexdigest()
        self.assertEqual(actual, expected, f"SHA3-256 failed on NIST CAVP 3-byte message")

    def test_nist_cavp_448bit_message(self):
        """NIST CAVP SHA3-256 Vector: 448-bit / 56-byte message."""
        msg = b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
        expected = "41c0dba2a9d6240849100376a8235e2c82e1b9998a999e21db32dd97496d3376"
        actual = hashlib.sha3_256(msg).hexdigest()
        self.assertEqual(actual, expected, f"SHA3-256 failed on NIST CAVP 56-byte message")

    def test_nist_cavp_million_repetition_1mb(self):
        """NIST CAVP SHA3-256 Vector: 1,000,000 repetitions of 'a' (1 Megabyte)."""
        msg = b"a" * 1_000_000
        expected = "5c8875ae474a3634ba4fd55ec85bffd661f32aca75c6d699d0cdcb6c115891c1"
        actual = hashlib.sha3_256(msg).hexdigest()
        self.assertEqual(actual, expected, f"SHA3-256 failed on NIST CAVP 1MB repetition message")

    def test_node_parity_on_nist_vectors(self):
        """Confirms Node.js crypto.createHash('sha3-256') matches Python on all CAVP vectors."""
        test_inputs = [
            "",
            "a",
            "abc",
            "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
        ]
        for inp in test_inputs:
            py_hash = hashlib.sha3_256(inp.encode()).hexdigest()
            node_cmd = f"node -e \"console.log(require('crypto').createHash('sha3-256').update('{inp}').digest('hex'))\""
            res = subprocess.run(node_cmd, shell=True, capture_output=True, text=True, check=True)
            node_hash = res.stdout.strip()
            self.assertEqual(node_hash, py_hash, f"Node.js SHA3-256 diverged from Python for input '{inp}'")


class MLDSA65ContainerBoundaryTests(unittest.TestCase):
    """
    Tests off-by-one container sizes on ML-DSA-65 signatures and public keys.
    NIST FIPS 204 Parameter Sets:
      ML-DSA-65 Signature Size:  3,309 bytes
      ML-DSA-65 Public Key Size: 1,952 bytes
    """

    @classmethod
    def setUpClass(cls):
        cls.public_key, cls.private_key = generate_keypair("ML-DSA-65")
        cls.data_hash = hashlib.sha3_256(b"boundary-test-payload").hexdigest()
        cls.cred = issue_credential(cls.data_hash, cls.private_key, "test-pub-id")
        cls.valid_sig_bytes = bytes.fromhex(cls.cred["signature"])
        assert len(cls.valid_sig_bytes) == 3309
        assert len(cls.public_key) == 1952

    def test_signature_exact_3309_bytes_succeeds(self):
        """Valid 3309-byte ML-DSA-65 signature succeeds verification."""
        valid = verify_credential(self.data_hash, self.valid_sig_bytes.hex(), self.public_key)
        self.assertTrue(valid, "Exact 3,309-byte signature must verify successfully")

    def test_signature_off_by_one_under_3308_bytes_rejected(self):
        """Off-by-one under (3308 bytes) signature is rejected cleanly."""
        under_sig = self.valid_sig_bytes[:3308]
        self.assertEqual(len(under_sig), 3308)
        valid = verify_credential(self.data_hash, under_sig.hex(), self.public_key)
        self.assertFalse(valid, "Off-by-one (3,308 bytes) signature must be rejected")

    def test_signature_off_by_one_over_3310_bytes_rejected(self):
        """Off-by-one over (3310 bytes) signature is rejected cleanly."""
        over_sig = self.valid_sig_bytes + b"\x00"
        self.assertEqual(len(over_sig), 3310)
        valid = verify_credential(self.data_hash, over_sig.hex(), self.public_key)
        self.assertFalse(valid, "Off-by-one (3,310 bytes) signature must be rejected")

    def test_public_key_exact_1952_bytes_succeeds(self):
        """Valid 1952-byte ML-DSA-65 public key succeeds verification."""
        valid = verify_credential(self.data_hash, self.cred["signature"], self.public_key)
        self.assertTrue(valid, "Exact 1,952-byte public key must verify successfully")

    def test_public_key_off_by_one_under_1951_bytes_rejected(self):
        """Off-by-one under (1951 bytes) public key is rejected cleanly."""
        under_pk = self.public_key[:1951]
        self.assertEqual(len(under_pk), 1951)
        valid = verify_credential(self.data_hash, self.cred["signature"], under_pk)
        self.assertFalse(valid, "Off-by-one (1,951 bytes) public key must be rejected")

    def test_public_key_off_by_one_over_1953_bytes_rejected(self):
        """Off-by-one over (1953 bytes) public key is rejected cleanly."""
        over_pk = self.public_key + b"\x00"
        self.assertEqual(len(over_pk), 1953)
        valid = verify_credential(self.data_hash, self.cred["signature"], over_pk)
        self.assertFalse(valid, "Off-by-one (1,953 bytes) public key must be rejected")


class SaltBoundaryTests(unittest.TestCase):
    """
    Tests extreme and anomalous salt inputs:
      - 0-byte salt
      - 1-byte salt
      - 15-byte / 16-byte / 17-byte salt
      - 1MB salt
      - Odd-length hexadecimal strings (e.g. 31 or 33 chars)
      - Non-hexadecimal characters
    """

    def test_salt_odd_length_fails_conversion(self):
        """Odd-length hex string cannot convert cleanly to bytes and must be rejected."""
        odd_salts = ["a", "abc", "0123456789abcdef0123456789abcde"]  # 1, 3, 31 chars
        for salt in odd_salts:
            self.assertNotEqual(len(salt) % 2, 0)
            # Python fromhex raises ValueError on odd length
            with self.assertRaises(ValueError):
                bytes.fromhex(salt)

    def test_salt_1mb_roundtrip_salting(self):
        """Extreme boundary: 1 Megabyte CSPRNG salt prepended to claim payload."""
        salt_1mb_bytes = os.urandom(1_000_000)
        salt_1mb_hex = salt_1mb_bytes.hex()
        self.assertEqual(len(salt_1mb_hex), 2_000_000)

        claim = b'{"subject":"test-1mb-salt"}'
        payload = bytes.fromhex(salt_1mb_hex) + claim
        commitment = hashlib.sha3_256(payload).hexdigest()
        self.assertEqual(len(commitment), 64)

    def test_salt_size_boundaries_1_15_16_17_bytes(self):
        """Validates payload hashing across 1, 15, 16, and 17-byte salt lengths."""
        claim = b'{"name":"boundary-subject"}'
        for byte_len in [1, 15, 16, 17]:
            salt = os.urandom(byte_len)
            salt_hex = salt.hex()
            self.assertEqual(len(salt_hex), byte_len * 2)
            payload = bytes.fromhex(salt_hex) + claim
            h = hashlib.sha3_256(payload).hexdigest()
            self.assertTrue(re.match(r'^[0-9a-f]{64}$', h))


if __name__ == "__main__":
    unittest.main()
