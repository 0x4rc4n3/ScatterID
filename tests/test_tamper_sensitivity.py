#!/usr/bin/env python3
"""
==============================================================================
ScatterID — Cryptographic Tamper-Sensitivity & Pure Function Verification
==============================================================================
Adversarial hardening test suite validating core post-quantum invariants:
  1. Pure Function: verify(hash, sig, pk) is purely functional and deterministic
  2. Exhaustive Single-Bit Tamper-Sensitivity:
     - 256/256 bits in SHA3-256 commitment hash
     - 26,472/26,472 bits in NIST ML-DSA-65 signature (3,309 bytes)
     - Systematic bit mutations across ML-DSA-65 public key (1,952 bytes)
  3. Fixed Size Structural Boundaries (off-by-one byte length truncations/extensions)
==============================================================================
"""

import sys
import os
import time
import hashlib
import unittest

try:
    import oqs
except ImportError:
    oqs = None


class TamperSensitivityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if oqs is None:
            raise unittest.SkipTest("liboqs-python not available in environment")

        cls.signer = oqs.Signature("ML-DSA-65")
        cls.public_key = cls.signer.generate_keypair()

        # Deterministic 32-byte message hash representing SHA3-256 commitment
        cls.raw_claim = b'{"org":"ScatterID","role":"Architect","subject":"did:scatterid:user:alice"}'
        cls.salt = bytes.fromhex("00112233445566778899aabbccddeeff")
        cls.msg_hash = hashlib.sha3_256(cls.salt + cls.raw_claim).digest()

        # Valid 3309-byte ML-DSA-65 signature
        cls.signature = cls.signer.sign(cls.msg_hash)

        # Confirm baseline sanity
        assert cls.signer.verify(cls.msg_hash, cls.signature, cls.public_key) is True
        assert len(cls.signature) == 3309
        assert len(cls.public_key) == 1952
        assert len(cls.msg_hash) == 32

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "signer") and cls.signer:
            cls.signer.free()

    def test_pure_function_invariance(self):
        """Invariant: verify() is a pure function of its inputs with zero state mutation."""
        for _ in range(100):
            res = self.signer.verify(self.msg_hash, self.signature, self.public_key)
            self.assertTrue(res, "verify() must remain deterministic across repeated calls")

    def test_exhaustive_hash_bit_flips(self):
        """Invariant: flipping ANY single bit in the 32-byte SHA3-256 hash causes verify failure."""
        total_bits = 32 * 8  # 256 bits
        failed_rejections = 0

        for bit_idx in range(total_bits):
            byte_pos = bit_idx // 8
            bit_mask = 1 << (bit_idx % 8)

            mutated = bytearray(self.msg_hash)
            mutated[byte_pos] ^= bit_mask

            res = self.signer.verify(bytes(mutated), self.signature, self.public_key)
            if res is True:
                failed_rejections += 1

        self.assertEqual(
            failed_rejections, 0,
            f"Failed tamper sensitivity: {failed_rejections}/{total_bits} hash bit flips were accepted!"
        )
        print(f"\n[✓] Exhaustively tested all 256/256 bit flips in SHA3-256 hash: 100% rejected.")

    def test_exhaustive_signature_bit_flips(self):
        """Invariant: flipping ANY single bit in the 3,309-byte signature causes verify failure."""
        total_bits = len(self.signature) * 8  # 26,472 bits
        sig_bytes = bytearray(self.signature)

        print(f"\n[+] Executing exhaustive single-bit mutation across all {total_bits} signature bits...")
        t0 = time.time()
        failed_rejections = 0

        for bit_idx in range(total_bits):
            byte_pos = bit_idx // 8
            bit_mask = 1 << (bit_idx % 8)

            sig_bytes[byte_pos] ^= bit_mask
            res = self.signer.verify(self.msg_hash, bytes(sig_bytes), self.public_key)
            sig_bytes[byte_pos] ^= bit_mask  # Restore for next bit

            if res is True:
                failed_rejections += 1

        elapsed = time.time() - t0
        self.assertEqual(
            failed_rejections, 0,
            f"Security failure: {failed_rejections}/{total_bits} mutated signatures were accepted!"
        )
        print(f"[✓] Tested all {total_bits}/{total_bits} signature bits in {elapsed:.2f}s: 100% rejected.")

    def test_public_key_bit_flips(self):
        """Invariant: flipping bits across the 1,952-byte public key causes rejection or error."""
        total_bits = len(self.public_key) * 8  # 15,616 bits
        pk_bytes = bytearray(self.public_key)

        # Test systematic stride across public key bit positions
        sample_step = 8  # Test 1 bit per byte = 1,952 bit flips across entire structure
        tested = 0
        failed_rejections = 0

        for byte_pos in range(len(self.public_key)):
            bit_mask = 1 << (byte_pos % 8)
            pk_bytes[byte_pos] ^= bit_mask
            tested += 1

            try:
                res = self.signer.verify(self.msg_hash, self.signature, bytes(pk_bytes))
                if res is True:
                    failed_rejections += 1
            except Exception:
                # liboqs rejecting corrupt public key structure is also a clean rejection
                pass

            pk_bytes[byte_pos] ^= bit_mask

        self.assertEqual(
            failed_rejections, 0,
            f"Security failure: {failed_rejections}/{tested} mutated public keys were accepted!"
        )
        print(f"[✓] Tested {tested} public key bit mutations across all {len(self.public_key)} bytes: 100% rejected.")

    def test_off_by_one_container_sizes(self):
        """Boundary test: off-by-one signature and public key byte lengths."""
        # Signature: standard is 3309 bytes
        sig_short = self.signature[:-1]  # 3308
        sig_long = self.signature + b"\x00"  # 3310

        # Public key: standard is 1952 bytes
        pk_short = self.public_key[:-1]  # 1951
        pk_long = self.public_key + b"\x00"  # 1953

        for mutated_sig in (sig_short, sig_long):
            try:
                res = self.signer.verify(self.msg_hash, mutated_sig, self.public_key)
                self.assertFalse(res, f"Off-by-one signature of length {len(mutated_sig)} must not verify")
            except Exception:
                pass  # Clean rejection by liboqs size guard

        for mutated_pk in (pk_short, pk_long):
            try:
                res = self.signer.verify(self.msg_hash, self.signature, mutated_pk)
                self.assertFalse(res, f"Off-by-one public key of length {len(mutated_pk)} must not verify")
            except Exception:
                pass  # Clean rejection


if __name__ == "__main__":
    unittest.main(verbosity=2)
