import unittest
from interface import issue_credential, verify_credential
from keygen import generate_keypair
import hashlib

class TestInterface(unittest.TestCase):
    def test_verify_rejects_foreign_public_key(self):
        # Genuine key vs untrusted key
        public_key_1, private_key_1 = generate_keypair("ML-DSA-65")
        public_key_2, private_key_2 = generate_keypair("ML-DSA-65")
        
        data_hash = hashlib.sha3_256(b"test data").hexdigest()
        attacker_cred = issue_credential(data_hash, private_key_2, "attacker_key_id")
        
        # Verify rejects signature created with an unauthorized key
        valid = verify_credential(data_hash, attacker_cred["signature"], public_key_1)
        self.assertFalse(valid, "Should reject signature from unauthorized key")

    def test_verify_invalid_hex_returns_false(self):
        public_key, _ = generate_keypair("ML-DSA-65")
        self.assertFalse(verify_credential("not_hex", "aabb", public_key))
        self.assertFalse(verify_credential("00" * 32, "not_hex", public_key))

    def test_issue_invalid_hex_raises(self):
        _, private_key = generate_keypair("ML-DSA-65")
        with self.assertRaises(ValueError):
            issue_credential("not_hex", private_key, "key_id")

if __name__ == '__main__':
    unittest.main()
