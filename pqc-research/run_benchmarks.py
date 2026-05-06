import time
import random

# Use local PQC engine to maintain 100% isolation from pqc-identity
try:
    from pqc_engine import generate_keypair, sign_message, verify_signature
    from telemetry import telemetry, BenchmarkTimer, simulate_network_throttle
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

# Mock some "Entity Context" names for telemetry diversity
ENTITIES = ["Student_Portal", "Admin_Gateway", "Ledger_Node_0", "Ledger_Node_1", "Ledger_Node_2", "Wallet_Ext"]

def run_benchmarks(rounds=20):
    print(f"🚀 Starting PQC Benchmarks (ML-DSA-44) - {rounds} rounds")
    print("-" * 50)

    for i in range(rounds):
        entity = random.choice(ENTITIES)
        print(f"Round {i+1}/{rounds} | Entity: {entity}")

        # 1. Keygen
        with BenchmarkTimer() as timer:
            did, pub, priv = generate_keypair()
        
        # Calculate approximate payload (DID + Pub + Priv hex lengths / 2)
        payload_size = (len(did) + len(pub) + len(priv)) // 2
        telemetry.record_metric("Key Generation", entity, timer.latency_ms, payload_size)
        print(f"  ✅ Keygen: {timer.latency_ms:.2f}ms")

        # 2. Signing
        message = f"PQC-AUTH-CHALLENGE-{random.getrandbits(64)}".encode()
        with BenchmarkTimer() as timer:
            # Add university network simulation for signing specifically
            @simulate_network_throttle(delay_ms=random.randint(5, 50))
            def timed_sign():
                return sign_message(priv, message)
            sig = timed_sign()

        payload_size = len(sig) // 2
        telemetry.record_metric("Digital Signature", entity, timer.latency_ms, payload_size)
        print(f"  ✅ Signing: {timer.latency_ms:.2f}ms")

        # 3. Verification
        with BenchmarkTimer() as timer:
            valid = verify_signature(pub, message, sig)
        
        telemetry.record_metric("Verification", entity, timer.latency_ms, len(message))
        print(f"  ✅ Verification: {timer.latency_ms:.2f}ms")
        
        time.sleep(0.5) # Gentle pause for visualization flow

    print("-" * 50)
    print(f"🏁 Benchmarks complete. Data saved to pqc-research/metrics.json")

if __name__ == "__main__":
    import sys
    # Allow passing rounds as argument
    rounds = 20
    if len(sys.argv) > 1:
        try:
            rounds = int(sys.argv[1])
        except ValueError:
            pass
            
    run_benchmarks(rounds)
