import unittest
import json
from interface import issue_credential, verify_credential
from keygen import generate_keypair
import hashlib

class TestInterface(unittest.TestCase):
    def test_verify_rejects_foreign_public_key(self):
        # We test that the verification function uses only the provided key 
        # The verify_hash endpoint handles registry lookup. We simulate that by
        # while verify_credential only takes the key passed to it by the endpoint).
        # verifying the credential purely against the expected valid key.
        
        # Key 1: Genuine ScatterID Key
        public_key_1, private_key_1 = generate_keypair("ML-DSA-65")
        
        # Key 2: Attacker Key
        public_key_2, private_key_2 = generate_keypair("ML-DSA-65")
        
        data_hash = hashlib.sha3_256(b"test data").hexdigest()
        
        # Attacker signs the hash with their own key
        attacker_cred = issue_credential(data_hash, private_key_2, "attacker_key_id")
        
        # The verification endpoint logic exclusively uses the public_key_id from the registry.
        # If the attacker passes publicKeyId="attacker_key_id", the registry returns None (or fails)
        # If the attacker passes publicKeyId="genuine_key_id", the registry returns public_key_1.
        # We simulate the registry returning public_key_1.
        
        valid = verify_credential(data_hash, attacker_cred["signature"], public_key_1)
        
        self.assertFalse(valid, "Should reject credential signed by foreign key despite any claims of public key identity")

if __name__ == '__main__':
    unittest.main()
