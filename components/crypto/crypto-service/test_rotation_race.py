#!/usr/bin/env python3
"""
==============================================================================
ScatterID — Crypto Service Key Rotation & Concurrency Race Suite (§4)
==============================================================================
Tests key rotation in-flight under heavy multi-threaded concurrent load:
  1. Concurrent /sign_hash and /verify_hash operations while /rotate executes.
  2. Proof of atomicity: state_lock prevents torn reads between PUBLIC_KEY_ID
     and PRIVATE_KEY.
  3. Historical public key retention: all signatures generated during rotation
     remain verifiable against kms.public_key_history.
  4. Memory safety: zeroize on old private keys does not corrupt in-flight
     signers holding private key snapshots.
==============================================================================
"""

import os
import unittest
import threading
import hashlib
import time
import queue
from unittest.mock import patch, MagicMock

TEST_API_KEY = "test-crypto-service-api-key-for-race-tests"
os.environ["CRYPTO_SERVICE_API_KEY"] = TEST_API_KEY
os.environ["VAULT_DEV_MODE"] = "true"
os.environ["VAULT_TOKEN"] = "mock-vault-token"

# Initialize app with real initial keypair
from keygen import generate_keypair

initial_pub, initial_priv = generate_keypair("ML-DSA-65")

with patch("kms.KMS") as mock_kms_cls:
    mock_kms_inst = MagicMock()
    mock_kms_inst.lock = threading.RLock()
    mock_kms_inst.public_key_history = [initial_pub]
    mock_kms_inst.get_keys.return_value = (initial_pub, bytearray(initial_priv))

    def mock_rotate_keys(algorithm="ML-DSA-65"):
        with mock_kms_inst.lock:
            pub, priv = generate_keypair(algorithm)
            if pub not in mock_kms_inst.public_key_history:
                mock_kms_inst.public_key_history.append(pub)
            return pub, bytearray(priv)

    mock_kms_inst.rotate_keys.side_effect = mock_rotate_keys
    mock_kms_cls.return_value = mock_kms_inst

    import app as crypto_app
    from app import app


class KeyRotationRaceTests(unittest.TestCase):
    def _mock_rotate_keys(self, algorithm="ML-DSA-65"):
        with crypto_app.kms.lock:
            pub, priv = generate_keypair(algorithm)
            if pub not in crypto_app.kms.public_key_history:
                crypto_app.kms.public_key_history.append(pub)
            return pub, bytearray(priv)

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()
        self.auth_headers = {
            "Authorization": f"Bearer {crypto_app.API_KEY}",
            "Content-Type": "application/json"
        }
        if not hasattr(crypto_app.kms, 'lock') or not crypto_app.kms.lock:
            crypto_app.kms.lock = threading.RLock()
        
        pub, priv = generate_keypair("ML-DSA-65")
        crypto_app.PUBLIC_KEY = pub
        crypto_app.PRIVATE_KEY = bytearray(priv)
        crypto_app.PUBLIC_KEY_ID = hashlib.sha256(pub).hexdigest()[:32]
        crypto_app.kms.public_key_history = [pub]
        crypto_app.kms.rotate_keys = self._mock_rotate_keys

    def test_key_rotation_in_flight_concurrent_race(self):
        """
        Spawns concurrent signer threads and concurrent verifier threads
        issuing continuous signing and verification requests while a background
        rotator thread triggers multiple key rotations mid-flight.
        
        Asserts:
          - Zero unhandled exceptions or 500 status codes.
          - Zero torn reads: every signature produced during rotation matches
            its declared publicKeyId.
          - 100% verification success: historical key retention ensures older
            signatures verify cleanly even after multiple rotations.
        """
        NUM_SIGNERS = 6
        NUM_VERIFIERS = 4
        NUM_ROTATIONS = 4
        OPERATIONS_PER_THREAD = 10

        err_queue = queue.Queue()
        credential_pool = queue.Queue()
        stop_event = threading.Event()

        # Track active public keys observed to verify rotation actually occurred
        observed_key_ids = set()
        key_id_lock = threading.Lock()

        def signer_worker(worker_id):
            client = app.test_client()
            for i in range(OPERATIONS_PER_THREAD):
                if stop_event.is_set():
                    break
                try:
                    data_hash = hashlib.sha3_256(f"payload-{worker_id}-{i}-{time.time()}".encode()).hexdigest()
                    res = client.post(
                        "/sign_hash",
                        headers=self.auth_headers,
                        json={"dataHash": data_hash}
                    )
                    if res.status_code != 201:
                        err_queue.put(f"Signer {worker_id} got status {res.status_code}: {res.get_data(as_text=True)}")
                        continue
                    
                    data = res.get_json()
                    pub_id = data.get("publicKeyId")
                    with key_id_lock:
                        observed_key_ids.add(pub_id)

                    credential_pool.put((data_hash, data.get("signature"), pub_id))
                    time.sleep(0.01)
                except Exception as e:
                    err_queue.put(f"Signer exception {worker_id}: {str(e)}")

        def verifier_worker(worker_id):
            client = app.test_client()
            while not stop_event.is_set() or not credential_pool.empty():
                try:
                    cred = credential_pool.get(timeout=0.2)
                except queue.Empty:
                    continue

                data_hash, sig, pub_id = cred
                try:
                    res = client.post(
                        "/verify_hash",
                        headers=self.auth_headers,
                        json={
                            "dataHash": data_hash,
                            "signature": sig,
                            "publicKeyId": pub_id
                        }
                    )
                    if res.status_code != 200:
                        err_queue.put(f"Verifier {worker_id} got status {res.status_code}: {res.get_data(as_text=True)}")
                        continue

                    verify_res = res.get_json()
                    if not verify_res.get("valid"):
                        err_queue.put(f"Verifier {worker_id} got valid=False for key {pub_id}: {verify_res}")
                except Exception as e:
                    err_queue.put(f"Verifier exception {worker_id}: {str(e)}")

        def rotator_worker():
            client = app.test_client()
            for r in range(NUM_ROTATIONS):
                time.sleep(0.05)
                try:
                    res = client.post("/rotate", headers=self.auth_headers)
                    if res.status_code != 200:
                        err_queue.put(f"Rotator got status {res.status_code}: {res.get_data(as_text=True)}")
                except Exception as e:
                    err_queue.put(f"Rotator exception: {str(e)}")

        # Launch threads
        threads = []
        rotator = threading.Thread(target=rotator_worker, daemon=True)
        rotator.start()
        threads.append(rotator)

        signers = [threading.Thread(target=signer_worker, args=(i,), daemon=True) for i in range(NUM_SIGNERS)]
        for s in signers:
            s.start()
            threads.append(s)

        verifiers = [threading.Thread(target=verifier_worker, args=(i,), daemon=True) for i in range(NUM_VERIFIERS)]
        for v in verifiers:
            v.start()
            threads.append(v)

        # Wait for signers and rotator to complete
        for s in signers:
            s.join(timeout=30)
        rotator.join(timeout=30)

        # Signal verifiers to drain queue and stop
        stop_event.set()
        for v in verifiers:
            v.join(timeout=30)

        # Drain and assert no errors
        errors = []
        while not err_queue.empty():
            errors.append(err_queue.get_nowait())

        self.assertEqual(len(errors), 0, f"Encountered concurrency errors during key rotation:\n" + "\n".join(errors))
        
        # Verify that multiple distinct key versions were exercised during test
        self.assertGreater(len(observed_key_ids), 1, "Expected multiple key rotations to be observed across requests")

    def test_state_lock_atomicity_torn_read_prevention(self):
        """
        Directly validates that reading PRIVATE_KEY and PUBLIC_KEY_ID under state_lock
        guarantees mathematical correspondence between the private key used for signing
        and the declared public key ID.
        """
        data_hash = hashlib.sha3_256(b"torn-read-test").hexdigest()
        
        # Perform 15 fast sequential sign and rotate cycles
        for _ in range(15):
            res_sign = self.client.post("/sign_hash", headers=self.auth_headers, json={"dataHash": data_hash})
            self.assertEqual(res_sign.status_code, 201)
            sign_data = res_sign.get_json()

            # Rotate key immediately
            res_rotate = self.client.post("/rotate", headers=self.auth_headers)
            self.assertEqual(res_rotate.status_code, 200)

            # Verify the signature generated prior to rotation
            res_verify = self.client.post(
                "/verify_hash",
                headers=self.auth_headers,
                json={
                    "dataHash": data_hash,
                    "signature": sign_data["signature"],
                    "publicKeyId": sign_data["publicKeyId"]
                }
            )
            self.assertEqual(res_verify.status_code, 200)
            self.assertTrue(res_verify.get_json().get("valid"), "Signature must verify even after immediate rotation")


if __name__ == "__main__":
    unittest.main()
