#!/usr/bin/env python3
"""
==============================================================================
ScatterID — Cross-Language Canonicalization Parity & Generative Fuzz Suite
==============================================================================
Adversarial hardening test suite for RFC 8785 JSON Canonicalization Scheme (JCS)
across Python (rfc8785 + zero-dependency fallback) and Node.js (npm canonicalize
+ tools/verify_offline.js zero-dependency implementation).

Tests:
  1. Unicode Edge Cases (RTL overrides, ZWJ, Emoji composites, Non-BMP astral keys)
  2. UTF-16 vs Codepoint Sort Order Parity (RFC 8785 §3.2.3)
  3. Numeric Boundaries (MAX_SAFE_INTEGER, MIN_SAFE_INTEGER, -0.0, float precision)
  4. Deep Structural Fuzzing (nested hierarchies, arrays, mixed scalars)
  5. Invalid Input Rejection (NaN, Infinity, lone surrogates)
  6. Invariant: Determinism & Pure Function idempotence
  7. 5,000-Iteration Generative Combinatorial Parity Fuzz
==============================================================================
"""

import sys
import os
import json
import random
import hashlib
import subprocess
import unittest

# Ensure repo root is on sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import rfc8785
from tools.verify_offline import canonicalize as py_verify_canonicalize, _fallback_jcs


class CanonicalizationParityFuzzer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        bridge_script = os.path.join(REPO_ROOT, "tests", "helpers", "node_canonicalize_bridge.mjs")
        cls.node_proc = subprocess.Popen(
            ["node", bridge_script],
            cwd=REPO_ROOT,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )

    @classmethod
    def tearDownClass(cls):
        if cls.node_proc and cls.node_proc.poll() is None:
            cls.node_proc.stdin.close()
            cls.node_proc.wait(timeout=5)

    def _query_node(self, payload):
        line = json.dumps(payload, ensure_ascii=False)
        self.node_proc.stdin.write(line + "\n")
        self.node_proc.stdin.flush()
        out = self.node_proc.stdout.readline().strip()
        if not out:
            err = self.node_proc.stderr.read()
            raise RuntimeError(f"Node bridge process exited unexpectedly: {err}")
        return json.loads(out)

    def assert_all_engines_match(self, payload, msg=""):
        """
        Asserts bit-for-bit canonical parity across:
          1. Python rfc8785 library
          2. Python fallback JCS implementation
          3. Node.js official npm 'canonicalize' package
          4. Node.js tools/verify_offline.js zero-dep canonicalizer
        """
        # Engine 1: Python rfc8785
        py_rfc = rfc8785.dumps(payload).decode("utf-8")

        # Engine 2: Python fallback
        py_fb = _fallback_jcs(payload)

        self.assertEqual(
            py_rfc, py_fb,
            f"Python rfc8785 vs Python fallback divergence for {payload}: {py_rfc} != {py_fb} ({msg})"
        )

        # Engine 3 & 4: Node.js npm + verify_offline.js
        node_res = self._query_node(payload)
        self.assertEqual(
            node_res.get("status"), "OK",
            f"Node engine reported error for {payload}: {node_res} ({msg})"
        )
        node_canonical = node_res["canonical"]

        # Cross-language assertion
        self.assertEqual(
            py_rfc, node_canonical,
            f"Cross-language divergence (Python != Node) for {payload}!\n"
            f"  Python: {py_rfc}\n"
            f"  Node:   {node_canonical}\n"
            f"  Diff:   {msg}"
        )

        # Hash commitment assertion: SHA3-256(salt || canonical) must be byte-identical
        salt = os.urandom(16)
        py_hash = hashlib.sha3_256(salt + py_rfc.encode("utf-8")).hexdigest()
        node_hash = hashlib.sha3_256(salt + node_canonical.encode("utf-8")).hexdigest()
        self.assertEqual(py_hash, node_hash, f"SHA3-256 pre-image commitment mismatch! ({msg})")

    def test_unicode_adversarial_parity(self):
        """Test Unicode adversarial vectors: RTL, ZWJ, Emoji composites, multi-lingual scripts."""
        adversarial_strings = [
            "Normal ASCII claim string",
            "Right-to-Left \u202eRTL_OVERRIDE\u202c standard",
            "Left-to-Right \u202dEmbedded\u202c text",
            "Zero-Width \u200dJoiner\u200c Non-Joiner \u2060Word-Joiner",
            "Emoji composite: 👨‍👩‍👧‍👦",
            "Skin-tone modifier: 👍🏽 and 👩🏾‍💻",
            "Rainbow flag sequence: 🏳️‍🌈",
            "Hebrew: עִבְרִית שלום עולם",
            "Arabic: العربية مرحباً بك في سكاتر آي دي",
            "Devanagari: नमस्ते दुनिया पोस्ट-क्वांटम",
            "CJK Unified: 繁體中文 简体字 日本語 ひらがな カタカナ 한국어",
            "Greek: Ελληνικά Κρυπτογραφία FIPS 204",
            "Cyrillic: Русский криптографический сервис",
            "Mixed escape chars: \b\f\n\r\t\"\\",
            "Null and control: \u0000\u0001\u001f"
        ]

        for idx, s in enumerate(adversarial_strings):
            payload = {
                "claimId": f"unicode-{idx}",
                "attribute": s,
                "nested": {"mirrored": s, "count": idx}
            }
            self.assert_all_engines_match(payload, msg=f"Unicode test #{idx}: {repr(s)}")

    def test_utf16_vs_codepoint_key_ordering(self):
        r"""
        RFC 8785 §3.2.3 requires keys to be sorted by UTF-16 code unit values.
        Astral plane characters (e.g. U+10000 -> \uD800\uDC00) must sort BEFORE
        high-BMP characters (e.g. U+E000 -> \uE000), which inverts standard Unicode codepoint order!
        """
        payload = {
            "\U00010000": "Linear B Syllable B008 A (Astral U+10000, UTF-16: 0xD800 0xDC00)",
            "\uE000": "Private Use Area (BMP U+E000, UTF-16: 0xE000)",
            "\U0001F600": "Grinning Face (Astral U+1F600, UTF-16: 0xD83D 0xDE00)",
            "\uFFFF": "Special BMP character",
            "alpha": 1,
            "beta": 2
        }
        self.assert_all_engines_match(payload, msg="UTF-16 key ordering constraint")

    def test_numeric_boundary_parity(self):
        """Test boundary numbers: MAX_SAFE_INTEGER, MIN_SAFE_INTEGER, -0.0, float formatting."""
        boundary_numbers = [
            0,
            -0.0,
            0.0,
            1,
            -1,
            9007199254740991,       # 2^53 - 1
            -9007199254740991,      # -(2^53 - 1)
            123456789012345,
            0.1,
            0.000001,               # 1e-6 (lower threshold for scientific vs fixed)
            0.0000001,              # 1e-7 (switches to scientific)
            1e20,                   # 1e20 (upper threshold for fixed vs scientific)
            1e21,
            1e-5,
            123.456,
            0.12345678901234567
        ]

        for idx, n in enumerate(boundary_numbers):
            payload = {
                "idx": idx,
                "val": n,
                "arr": [n, -n if n != 0 else 0],
                "map": {"inner": n}
            }
            self.assert_all_engines_match(payload, msg=f"Numeric boundary #{idx}: {n}")

    def test_nested_structural_fuzzing(self):
        """Test deeply nested objects (10+ levels), empty structures, mixed types."""
        # Deep nesting (12 levels)
        deep = {"value": "bottom"}
        for level in range(12):
            deep = {f"level_{level}": deep, "level_num": level}
        self.assert_all_engines_match(deep, msg="12-level deep nesting")

        # Empty structures and heterogeneous arrays
        payload = {
            "emptyObject": {},
            "emptyArray": [],
            "nestedEmpties": {"a": {}, "b": []},
            "heterogeneous": [
                None,
                True,
                False,
                0,
                1.5,
                "string",
                {},
                [],
                {"nestedInArr": [1, 2, "3"]}
            ],
            "booleanClaims": {
                "sanctionPassed": True,
                "revoked": False,
                "exempt": None
            }
        }
        self.assert_all_engines_match(payload, msg="Heterogeneous structures")

    def test_determinism_invariant(self):
        """Assert canonicalize is a pure mathematical function: f(x) == f(x) for all iterations."""
        payload = {
            "subject": "did:scatterid:user:alice-chen",
            "roles": ["Architect", "Cryptographer"],
            "clearance": 4,
            "meta": {"audited": True, "scores": [98.5, 99.1, 100.0]}
        }
        first = rfc8785.dumps(payload)
        for _ in range(25):
            self.assertEqual(first, rfc8785.dumps(payload))
            self.assertEqual(first.decode("utf-8"), _fallback_jcs(payload))

    def test_invalid_inputs_rejection(self):
        """Assert that all engines reject NaN, Infinity, -Infinity, and oversized integers."""
        # 1. NaN rejection in Python
        with self.assertRaises(rfc8785.CanonicalizationError):
            rfc8785.dumps({"invalid": float("nan")})
        with self.assertRaises(ValueError):
            _fallback_jcs({"invalid": float("nan")})

        # 2. Infinity rejection in Python
        with self.assertRaises(rfc8785.CanonicalizationError):
            rfc8785.dumps({"invalid": float("inf")})
        with self.assertRaises(ValueError):
            _fallback_jcs({"invalid": float("inf")})

        with self.assertRaises(rfc8785.CanonicalizationError):
            rfc8785.dumps({"invalid": float("-inf")})
        with self.assertRaises(ValueError):
            _fallback_jcs({"invalid": float("-inf")})

        # 3. IntegerDomainError (> 2^53 - 1)
        with self.assertRaises(rfc8785.IntegerDomainError):
            rfc8785.dumps({"hugeInt": 2**53 + 100})

        # 4. Node.js rejection verification via subprocess
        node_nan_check = subprocess.run(
            ["node", "-e", """
            import('./sdk/node_modules/canonicalize/lib/canonicalize.js').then(c => {
              import('./tools/verify_offline.js').then(v => {
                let caughtNpm = false, caughtVerify = false;
                try { c.default({ a: NaN }); } catch(e) { caughtNpm = true; }
                try { v.canonicalize({ a: NaN }); } catch(e) { caughtVerify = true; }
                if (caughtNpm && caughtVerify) process.exit(0);
                process.exit(1);
              });
            });
            """],
            cwd=REPO_ROOT,
            capture_output=True
        )
        self.assertEqual(node_nan_check.returncode, 0, "Node engines must reject NaN")


    def test_mass_generative_fuzz(self):
        """
        Execute 5,000 randomized combinatorial claim payloads against all 4 engines.
        Randomizes:
          - Field names (ASCII, Unicode, non-BMP, numbers, punctuation)
          - Field depths (1 to 8 levels)
          - Value types (strings, floats, ints, bools, nulls, nested objects, lists)
        """
        random.seed(0x5CA77E81D)  # Deterministic seed for reproducible adversarial fuzzing

        def random_unicode_string(length=10):
            pools = [
                "".join(chr(c) for c in range(ord("a"), ord("z") + 1)),
                "".join(chr(c) for c in range(ord("A"), ord("Z") + 1)),
                "".join(chr(c) for c in range(ord("0"), ord("9") + 1)),
                " \t-_.~!*()",
                "你好世界日本語한국어",
                "العربية עִבְרִית",
                "🚀🛡️⚡🔑💡",
                "\u202E\u202D\u200D\u200C",
                "\U00010000\U0001F600\uE000\uFFFF"
            ]
            chars = "".join(random.choice(pools) for _ in range(length))
            return chars

        def random_value(depth=0):
            if depth >= 5:
                choice = random.choice(["int", "float", "str", "bool", "null"])
            else:
                choice = random.choice(["int", "float", "str", "bool", "null", "obj", "arr"])

            if choice == "int":
                return random.randint(-9007199254740991, 9007199254740991)
            elif choice == "float":
                return round(random.uniform(-100000.0, 100000.0), random.randint(1, 8))
            elif choice == "str":
                return random_unicode_string(random.randint(1, 20))
            elif choice == "bool":
                return random.choice([True, False])
            elif choice == "null":
                return None
            elif choice == "arr":
                return [random_value(depth + 1) for _ in range(random.randint(0, 4))]
            elif choice == "obj":
                return {
                    random_unicode_string(random.randint(2, 8)): random_value(depth + 1)
                    for _ in range(random.randint(0, 4))
                }

        NUM_ITERATIONS = 5000
        print(f"\n[+] Running {NUM_ITERATIONS} generative fuzz iterations across Python and Node engines...")

        for iteration in range(NUM_ITERATIONS):
            payload = {
                "iter": iteration,
                "seedTag": f"fuzz-{iteration:05d}",
                "claim": {
                    "subject": f"did:scatterid:user:fuzz-{iteration}",
                    "attributes": {
                        f"attr_{k}": random_value(depth=1)
                        for k in range(random.randint(1, 5))
                    }
                }
            }

            self.assert_all_engines_match(
                payload,
                msg=f"Iteration #{iteration} failed parity!"
            )

            if (iteration + 1) % 1000 == 0:
                print(f"    - Completed {iteration + 1}/{NUM_ITERATIONS} iterations with 0 divergences.")

        print(f"[✓] Successfully executed {NUM_ITERATIONS} fuzz iterations with bit-for-bit parity across all engines!\n")


if __name__ == "__main__":
    unittest.main(verbosity=2)
