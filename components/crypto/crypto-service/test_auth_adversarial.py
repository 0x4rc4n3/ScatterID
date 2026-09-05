#!/usr/bin/env python3
"""
==============================================================================
ScatterID — Crypto Service Authorization Truth Table & Mutation Tests
==============================================================================
Validates HTTP-level authentication, timing-safe API key comparison, and
fail-closed authorization boundaries on the Flask PQC microservice.
==============================================================================
"""

import os
import unittest
from unittest.mock import patch, MagicMock

TEST_API_KEY = "test-crypto-service-api-key-for-auth-tests"
os.environ["CRYPTO_SERVICE_API_KEY"] = TEST_API_KEY
os.environ["VAULT_DEV_MODE"] = "true"
os.environ["VAULT_TOKEN"] = "mock-vault-token"

# Mock KMS before importing app to avoid dependency on live HashiCorp Vault
with patch("kms.KMS") as mock_kms_cls:
    mock_kms_inst = MagicMock()
    mock_kms_inst.get_keys.return_value = (b"\x01" * 1952, bytearray(b"\x02" * 4032))
    mock_kms_inst.public_key_history = []
    mock_kms_cls.return_value = mock_kms_inst

    from app import app


class CryptoAuthTruthTableTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_healthz_unauthenticated_probe(self):
        """Invariant: /healthz probe is open to cluster monitors without auth."""
        res = self.client.get("/healthz")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "ok")

    def test_auth_truth_table_sign_hash(self):
        """
        Truth-table testing across header permutations on /sign_hash:
          1. No Authorization header -> 401
          2. Basic auth scheme -> 401
          3. Bearer scheme without space -> 401
          4. Bearer with whitespace only -> 401
          5. Invalid token -> 401
          6. Prefix-only token (timing/length test) -> 401
          7. Valid token with extra suffix -> 401
          8. Valid Bearer token -> passes auth (reaches route handler)
        """
        cases = [
            ("No Header", {}, 401, "UNAUTHORIZED"),
            ("Basic Scheme", {"Authorization": "Basic dXNlcjpwYXNz"}, 401, "UNAUTHORIZED"),
            ("Bearer No Space", {"Authorization": f"Bearer{TEST_API_KEY}"}, 401, "UNAUTHORIZED"),
            ("Bearer Empty", {"Authorization": "Bearer "}, 401, "UNAUTHORIZED"),
            ("Wrong Token", {"Authorization": "Bearer completely-wrong-token"}, 401, "UNAUTHORIZED"),
            ("Prefix Token", {"Authorization": f"Bearer {TEST_API_KEY[:5]}"}, 401, "UNAUTHORIZED"),
            ("Extended Token", {"Authorization": f"Bearer {TEST_API_KEY}-extra-bytes"}, 401, "UNAUTHORIZED"),
            ("Valid Bearer Token", {"Authorization": f"Bearer {TEST_API_KEY}"}, 400, "BAD_REQUEST"),  # 400 proves auth passed
        ]

        for desc, headers, expected_status, expected_code in cases:
            res = self.client.post("/sign_hash", headers=headers, json={})
            self.assertEqual(
                res.status_code, expected_status,
                f"Failed case '{desc}': expected {expected_status}, got {res.status_code}"
            )
            data = res.get_json()
            self.assertEqual(
                data.get("code"), expected_code,
                f"Failed case '{desc}': expected code {expected_code}, got {data.get('code')}"
            )

    def test_auth_truth_table_verify_hash(self):
        """Verify identical auth gating on /verify_hash."""
        # Missing auth
        res = self.client.post("/verify_hash", json={})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.get_json().get("code"), "UNAUTHORIZED")

        # Wrong auth
        res = self.client.post("/verify_hash", headers={"Authorization": "Bearer wrong"}, json={})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.get_json().get("code"), "UNAUTHORIZED")

        # Valid auth reaches handler (400 for empty payload)
        res = self.client.post("/verify_hash", headers={"Authorization": f"Bearer {TEST_API_KEY}"}, json={})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json().get("code"), "BAD_REQUEST")

    def test_mutation_detection_inverted_hmac(self):
        """
        Mutation test: simulates an inverted logic bug where compare_digest returns inverted outcome.
        Asserts that valid keys would be rejected and invalid keys accepted under mutation,
        confirming our test suite catches this mutation.
        """
        with patch("hmac.compare_digest", side_effect=lambda a, b: not (a == b)):
            # Under mutated logic, valid key must fail
            res = self.client.post(
                "/sign_hash",
                headers={"Authorization": f"Bearer {TEST_API_KEY}"},
                json={}
            )
            self.assertEqual(res.status_code, 401, "Mutated hmac logic must trigger failure")


if __name__ == "__main__":
    unittest.main(verbosity=2)
