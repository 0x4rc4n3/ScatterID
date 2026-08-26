import unittest
import json
from interface import package_credential, unpackage_credential
from keygen import generate_keypair

class TestInterface(unittest.TestCase):
    def test_unpackage_rejects_foreign_public_key(self):
        public_key_1, private_key_1 = generate_keypair("ML-DSA-65")
        public_key_2, private_key_2 = generate_keypair("ML-DSA-65")
        
        claim = {"subject": "test"}
        malicious_credential = package_credential(claim, private_key_2, public_key=public_key_2)
        shares_subset = malicious_credential["shares"]["shares"][:3]
        
        recovered_bytes, valid = unpackage_credential(malicious_credential, public_key_1, shares_subset)
        self.assertFalse(valid, "Should reject credential signed by foreign key despite embedded public_key")

if __name__ == '__main__':
    unittest.main()
