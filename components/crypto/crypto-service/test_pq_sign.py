import unittest
import hashlib
from keygen import generate_keypair
from pq_sign import sign_data, verify_signature


class TestPQSign(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.public_key, cls.private_key = generate_keypair("ML-DSA-65")

    def test_round_trip_sign_verify(self):
        """Signing and then verifying with the correct key should succeed."""
        data = hashlib.sha3_256(b"test payload").digest()
        sig = sign_data(data, self.private_key)
        self.assertTrue(verify_signature(data, sig, self.public_key))

    def test_tampered_signature_rejected(self):
        """A corrupted signature must be rejected."""
        data = hashlib.sha3_256(b"test payload").digest()
        sig = sign_data(data, self.private_key)
        tampered = bytearray(sig)
        tampered[0] ^= 0xFF
        self.assertFalse(verify_signature(data, bytes(tampered), self.public_key))

    def test_wrong_key_rejected(self):
        """Verifying with a different key pair must fail."""
        data = hashlib.sha3_256(b"test payload").digest()
        sig = sign_data(data, self.private_key)
        other_pub, _ = generate_keypair("ML-DSA-65")
        self.assertFalse(verify_signature(data, sig, other_pub))

    def test_wrong_algorithm_rejected(self):
        """Requesting an unsupported algorithm raises ValueError."""
        data = hashlib.sha3_256(b"test payload").digest()
        with self.assertRaises(ValueError):
            sign_data(data, self.private_key, algorithm="INVALID-ALG")
        with self.assertRaises(ValueError):
            verify_signature(data, b"sig", self.public_key, algorithm="INVALID-ALG")

    def test_empty_data_rejected(self):
        """Empty data must raise ValueError on sign and verify."""
        with self.assertRaises(ValueError):
            sign_data(b"", self.private_key)
        data = hashlib.sha3_256(b"test").digest()
        sig = sign_data(data, self.private_key)
        with self.assertRaises(ValueError):
            verify_signature(b"", sig, self.public_key)

    def test_empty_private_key_rejected(self):
        """Empty private key must raise ValueError."""
        data = hashlib.sha3_256(b"test").digest()
        with self.assertRaises(ValueError):
            sign_data(data, b"")

    def test_empty_signature_rejected(self):
        """Empty signature must raise ValueError on verify."""
        data = hashlib.sha3_256(b"test").digest()
        with self.assertRaises(ValueError):
            verify_signature(data, b"", self.public_key)

    def test_empty_public_key_rejected(self):
        """Empty public key must raise ValueError on verify."""
        data = hashlib.sha3_256(b"test").digest()
        sig = sign_data(data, self.private_key)
        with self.assertRaises(ValueError):
            verify_signature(data, sig, b"")


if __name__ == "__main__":
    unittest.main()
