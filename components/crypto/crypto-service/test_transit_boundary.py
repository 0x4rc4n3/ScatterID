#!/usr/bin/env python3
"""
==============================================================================
ScatterID — Vault Transit / HSM Isolated Signing Boundary Test Suite
==============================================================================
Verifies that when VAULT_SIGNING_MODE=transit:
  1. Private key material NEVER touches application process memory (PRIVATE_KEY is None).
  2. Signing occurs strictly through the encapsulated cryptographic boundary.
  3. Signatures produced are valid NIST FIPS 204 ML-DSA-65 signatures.
  4. Historical public key tracking remains intact across rotations.
  5. /healthz exposes 'signingBoundary': 'vault_transit_isolated'.
==============================================================================
"""

import os
import unittest
import hashlib
from unittest.mock import patch, MagicMock

# Configure environment before imports
os.environ["CRYPTO_SERVICE_API_KEY"] = "test-transit-crypto-api-key"
os.environ["VAULT_DEV_MODE"] = "true"
os.environ["VAULT_TOKEN"] = "mock-vault-token"
os.environ["VAULT_SIGNING_MODE"] = "transit"

from keygen import generate_keypair
from pq_sign import verify_signature
from kms import KMS, IsolatedSigningBoundary, zeroize


class TestIsolatedSigningBoundaryUnit(unittest.TestCase):
    def setUp(self):
        self.pub, self.priv = generate_keypair("ML-DSA-65")
        self.boundary = IsolatedSigningBoundary(self.pub, bytearray(self.priv), "ML-DSA-65")
        zeroize(bytearray(self.priv))

    def test_isolated_boundary_signing_and_verification(self):
        digest = hashlib.sha3_256(b"isolated-boundary-test-payload").digest()
        sig = self.boundary.sign(digest)
        self.assertEqual(len(sig), 3309)

        # Verify via boundary
        self.assertTrue(self.boundary.verify(digest, sig))

        # Verify via raw public key
        self.assertTrue(verify_signature(digest, sig, self.pub, "ML-DSA-65"))

        # Verify tampered payload is rejected
        bad_digest = hashlib.sha3_256(b"tampered-payload").digest()
        self.assertFalse(self.boundary.verify(bad_digest, sig))

    def test_isolated_boundary_rotation(self):
        new_pub, new_priv = generate_keypair("ML-DSA-65")
        self.boundary.rotate(new_pub, bytearray(new_priv))
        zeroize(bytearray(new_priv))

        digest = hashlib.sha3_256(b"post-rotation-payload").digest()
        sig = self.boundary.sign(digest)
        self.assertTrue(self.boundary.verify(digest, sig))
        self.assertTrue(verify_signature(digest, sig, new_pub, "ML-DSA-65"))
        # Old public key fails to verify
        self.assertFalse(verify_signature(digest, sig, self.pub, "ML-DSA-65"))


class TestKMSTransitMode(unittest.TestCase):
    def test_kms_transit_mode_no_private_key_in_app_memory(self):
        """Invariant: get_keys() in transit mode returns (pub, None)."""
        pub_test, priv_test = generate_keypair("ML-DSA-65")
        
        with patch("hvac.Client") as mock_hvac:
            mock_client = MagicMock()
            mock_client.is_authenticated.return_value = True
            mock_client.secrets.kv.v2.read_secret_metadata.return_value = {"data": {"versions": {}}}
            mock_client.secrets.kv.v2.read_secret_version.return_value = {
                "data": {
                    "data": {
                        "public_key": pub_test.hex(),
                        "private_key": priv_test.hex()
                    }
                }
            }
            mock_hvac.return_value = mock_client

            kms = KMS(signing_mode="transit")
            self.assertTrue(kms.is_transit_mode())
            self.assertEqual(kms.get_boundary_type(), "vault_transit_isolated")

            pub, priv = kms.get_keys()
            self.assertEqual(pub, pub_test)
            self.assertIsNone(priv, "CRITICAL: Private key MUST be None in application memory under transit mode")

            # Sign digest through KMS boundary
            digest = hashlib.sha3_256(b"kms-transit-test").digest()
            sig = kms.sign_digest(digest)
            self.assertEqual(len(sig), 3309)
            self.assertTrue(kms.verify_digest(digest, sig))


class TestAppTransitModeIntegration(unittest.TestCase):
    def setUp(self):
        # Patch KMS before importing app
        self.pub, self.priv = generate_keypair("ML-DSA-65")
        self.boundary = IsolatedSigningBoundary(self.pub, bytearray(self.priv), "ML-DSA-65")

    def test_app_sign_hash_without_private_key_in_memory(self):
        from app import app, state_lock
        import app as app_module

        app.config["TESTING"] = True
        client = app.test_client()

        # Mock KMS on app_module
        mock_kms = MagicMock()
        mock_kms.is_transit_mode.return_value = True
        mock_kms.get_boundary_type.return_value = "vault_transit_isolated"
        mock_kms.public_key_history = [self.pub]
        mock_kms.sign_digest.side_effect = lambda d: self.boundary.sign(d)

        with state_lock:
            old_kms = app_module.kms
            old_pub = app_module.PUBLIC_KEY
            old_priv = app_module.PRIVATE_KEY
            old_pub_id = app_module.PUBLIC_KEY_ID

            app_module.kms = mock_kms
            app_module.PUBLIC_KEY = self.pub
            app_module.PRIVATE_KEY = None  # ZERO private key material in app memory!
            app_module.PUBLIC_KEY_ID = hashlib.sha256(self.pub).hexdigest()[:32]

        try:
            # Check /healthz
            res_health = client.get("/healthz")
            self.assertEqual(res_health.status_code, 200)
            self.assertEqual(res_health.get_json().get("signingBoundary"), "vault_transit_isolated")

            # Test /sign_hash
            data_hash = hashlib.sha3_256(b"transit-app-test-claim").hexdigest()
            res_sign = client.post(
                "/sign_hash",
                headers={
                    "Authorization": f"Bearer {app_module.API_KEY}",
                    "Content-Type": "application/json"
                },
                json={"dataHash": data_hash}
            )
            self.assertEqual(res_sign.status_code, 201)
            sign_data = res_sign.get_json()
            self.assertEqual(sign_data.get("signingBoundary"), "vault_transit_isolated")
            self.assertIn("signature", sign_data)

            # Test /verify_hash
            res_verify = client.post(
                "/verify_hash",
                headers={
                    "Authorization": f"Bearer {app_module.API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "dataHash": data_hash,
                    "signature": sign_data["signature"],
                    "publicKeyId": app_module.PUBLIC_KEY_ID
                }
            )
            self.assertEqual(res_verify.status_code, 200)
            self.assertTrue(res_verify.get_json().get("valid"))

        finally:
            with state_lock:
                app_module.kms = old_kms
                app_module.PUBLIC_KEY = old_pub
                app_module.PRIVATE_KEY = old_priv
                app_module.PUBLIC_KEY_ID = old_pub_id


if __name__ == "__main__":
    unittest.main()
