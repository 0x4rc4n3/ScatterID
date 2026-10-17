#!/usr/bin/env python3
"""
ScatterID — Cryptography Bill of Materials (CBOM) Compliance Tests
Verifies that generated CBOM satisfies CycloneDX 1.6 Cryptographic specification
and inventories all ScatterID cryptographic primitives accurately.
"""

import os
import sys
import unittest

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(DIR, ".."))
sys.path.insert(0, os.path.join(ROOT_DIR, "tools"))

from generate_cbom import generate_cbom

class TestCBOMCompliance(unittest.TestCase):
    def setUp(self):
        self.cbom = generate_cbom()

    def test_cyclonedx_1_6_envelope_structure(self):
        self.assertEqual(self.cbom["bomFormat"], "CycloneDX")
        self.assertEqual(self.cbom["specVersion"], "1.6")
        self.assertTrue(self.cbom["serialNumber"].startswith("urn:uuid:"))
        self.assertIn("components", self.cbom)
        self.assertGreaterEqual(len(self.cbom["components"]), 8)

    def test_post_quantum_signatures_inventoried(self):
        algos = {
            c["name"]: c["cryptoProperties"]
            for c in self.cbom["components"]
            if c.get("cryptoProperties", {}).get("assetType") == "algorithm"
        }

        self.assertIn("ML-DSA-65", algos)
        ml_dsa_65 = algos["ML-DSA-65"]["algorithmProperties"]
        self.assertEqual(ml_dsa_65["primitive"], "signature")
        self.assertEqual(ml_dsa_65["nistQuantumSecurityLevel"], 3)
        self.assertEqual(ml_dsa_65["classicalSecurityLevel"], 192)
        self.assertIn("sign", ml_dsa_65["cryptoFunctions"])
        self.assertIn("verify", ml_dsa_65["cryptoFunctions"])

        self.assertIn("ML-DSA-87", algos)
        self.assertEqual(algos["ML-DSA-87"]["algorithmProperties"]["nistQuantumSecurityLevel"], 5)

    def test_zero_knowledge_and_canonicalization_inventoried(self):
        names = [c["name"] for c in self.cbom["components"]]
        self.assertIn("SHA3-256", names)
        self.assertIn("RFC 8785 JCS", names)

    def test_symmetric_and_kdf_primitives_inventoried(self):
        names = [c["name"] for c in self.cbom["components"]]
        self.assertIn("Argon2id", names)
        self.assertIn("AES-256-GCM", names)
        self.assertIn("HMAC-SHA256", names)

    def test_certificates_and_protocols(self):
        asset_types = [
            c.get("cryptoProperties", {}).get("assetType")
            for c in self.cbom["components"]
        ]
        self.assertIn("certificate", asset_types)
        self.assertIn("protocol", asset_types)

if __name__ == "__main__":
    unittest.main()
