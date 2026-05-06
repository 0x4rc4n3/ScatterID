"""
pqc_engine.py — ML-DSA-44 (Dilithium2) PQC cryptography engine
Calls liboqs direct function API — compatible with liboqs 0.x and 1.x.
No OQS_SIG struct coupling; uses stable exported symbols.
"""
import ctypes
import os
import hashlib

# ── Locate liboqs ──────────────────────────────────────────────────

_BASE        = os.path.dirname(os.path.abspath(__file__))
_LIBOQS_ROOT = os.path.normpath(os.path.join(_BASE, "..", "liboqs"))

_LIB_SEARCH_PATHS = [
    os.path.join(_LIBOQS_ROOT, "install", "usr", "local", "lib", "liboqs.so"),
    os.path.join(_LIBOQS_ROOT, "build", "lib", "liboqs.so"),
    os.path.expanduser("~/.pqc_ledger/liboqs/install/usr/local/lib/liboqs.so"),
    "/usr/local/lib/liboqs.so",
    "/usr/lib/liboqs.so",
]

_lib = None

def _load_lib():
    global _lib
    if _lib is not None:
        return _lib
    for p in _LIB_SEARCH_PATHS:
        p = os.path.normpath(p)
        if not os.path.exists(p):
            continue
        lib_dir = os.path.dirname(p)
        ld = os.environ.get("LD_LIBRARY_PATH", "")
        if lib_dir not in ld:
            os.environ["LD_LIBRARY_PATH"] = lib_dir + (":" + ld if ld else "")
        try:
            candidate = ctypes.CDLL(p)
            # Probe a symbol we know exists
            _ = candidate.OQS_SIG_ml_dsa_44_keypair
            _lib = candidate
            print(f"[PQC] liboqs loaded: {p}")
            return _lib
        except (OSError, AttributeError) as e:
            print(f"[PQC] skip {p}: {e}")
    raise RuntimeError(
        "liboqs.so not found. Searched:\n  " + "\n  ".join(_LIB_SEARCH_PATHS)
    )

# ── ML-DSA-44 constants (NIST FIPS 204, Level 2) ──────────────────

PK_LEN  = 1312   # ML-DSA-44 public key bytes
SK_LEN  = 2560   # ML-DSA-44 secret key bytes
SIG_LEN = 2420   # ML-DSA-44 max signature bytes

# ── Public API ─────────────────────────────────────────────────────

def generate_keypair():
    """
    Generate an ML-DSA-44 (Dilithium2) keypair.
    Returns: (did: str, pubkey_hex: str, privkey_hex: str)
    """
    lib = _load_lib()

    # int OQS_SIG_ml_dsa_44_keypair(uint8_t *pk, uint8_t *sk)
    lib.OQS_SIG_ml_dsa_44_keypair.restype  = ctypes.c_int
    lib.OQS_SIG_ml_dsa_44_keypair.argtypes = [
        ctypes.POINTER(ctypes.c_uint8),  # pk
        ctypes.POINTER(ctypes.c_uint8),  # sk
    ]

    pk_buf = (ctypes.c_uint8 * PK_LEN)()
    sk_buf = (ctypes.c_uint8 * SK_LEN)()
    rc = lib.OQS_SIG_ml_dsa_44_keypair(pk_buf, sk_buf)
    if rc != 0:
        raise RuntimeError(f"ML-DSA-44 keygen failed (rc={rc})")

    pubkey_hex  = bytes(pk_buf).hex()
    privkey_hex = bytes(sk_buf).hex()
    did         = _make_did(bytes(pk_buf))
    return did, pubkey_hex, privkey_hex


def sign_message(privkey_hex: str, message: bytes) -> str:
    """
    Sign a message with an ML-DSA-44 secret key.
    Returns: hex-encoded signature
    """
    lib = _load_lib()

    # int OQS_SIG_ml_dsa_44_sign(uint8_t *sig, size_t *siglen,
    #                             const uint8_t *msg, size_t msglen,
    #                             const uint8_t *sk)
    lib.OQS_SIG_ml_dsa_44_sign.restype  = ctypes.c_int
    lib.OQS_SIG_ml_dsa_44_sign.argtypes = [
        ctypes.POINTER(ctypes.c_uint8),  # sig
        ctypes.POINTER(ctypes.c_size_t), # siglen
        ctypes.POINTER(ctypes.c_uint8),  # msg
        ctypes.c_size_t,                 # msglen
        ctypes.POINTER(ctypes.c_uint8),  # sk
    ]

    sk_bytes = bytes.fromhex(privkey_hex)
    if len(sk_bytes) != SK_LEN:
        raise ValueError(f"Invalid SK length: {len(sk_bytes)} (expected {SK_LEN})")

    sk_buf  = (ctypes.c_uint8 * SK_LEN)(*sk_bytes)
    sig_buf = (ctypes.c_uint8 * SIG_LEN)()
    sig_len = ctypes.c_size_t(SIG_LEN)
    msg_buf = (ctypes.c_uint8 * len(message))(*message)

    rc = lib.OQS_SIG_ml_dsa_44_sign(
        sig_buf, ctypes.byref(sig_len),
        msg_buf, len(message),
        sk_buf
    )
    if rc != 0:
        raise RuntimeError(f"Signing failed (rc={rc})")

    return bytes(sig_buf[:sig_len.value]).hex()


def verify_signature(pubkey_hex: str, message: bytes, sig_hex: str) -> bool:
    """
    Verify an ML-DSA-44 signature.
    Returns True if valid, False otherwise (never raises on bad sig).
    """
    try:
        lib = _load_lib()

        # int OQS_SIG_ml_dsa_44_verify(const uint8_t *msg, size_t msglen,
        #                               const uint8_t *sig, size_t siglen,
        #                               const uint8_t *pk)
        lib.OQS_SIG_ml_dsa_44_verify.restype  = ctypes.c_int
        lib.OQS_SIG_ml_dsa_44_verify.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),  # msg
            ctypes.c_size_t,                 # msglen
            ctypes.POINTER(ctypes.c_uint8),  # sig
            ctypes.c_size_t,                 # siglen
            ctypes.POINTER(ctypes.c_uint8),  # pk
        ]

        pk_bytes  = bytes.fromhex(pubkey_hex)
        sig_bytes = bytes.fromhex(sig_hex)

        if len(pk_bytes) != PK_LEN:
            return False

        pk_buf  = (ctypes.c_uint8 * PK_LEN)(*pk_bytes)
        sig_buf = (ctypes.c_uint8 * len(sig_bytes))(*sig_bytes)
        msg_buf = (ctypes.c_uint8 * len(message))(*message)

        rc = lib.OQS_SIG_ml_dsa_44_verify(
            msg_buf, len(message),
            sig_buf, len(sig_bytes),
            pk_buf
        )
        return rc == 0
    except Exception:
        return False


# ── DID generation (did:key spec) ─────────────────────────────────

_B58_ALPHA = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

def _b58encode(data: bytes) -> str:
    leading = sum(1 for b in data if b == 0)
    n = int.from_bytes(data, "big")
    out = []
    while n:
        n, r = divmod(n, 58)
        out.append(_B58_ALPHA[r:r+1])
    return (b"1" * leading + b"".join(reversed(out))).decode()

def _make_did(pk_bytes: bytes) -> str:
    """
    Derive a shorter did:key from ML-DSA-44 public key.
    Uses SHA3-256 hash to keep DID length small (~22-26 chars).
    """
    digest = hashlib.sha3_256(pk_bytes).digest()[:16] # 16 bytes entropy
    # multicodec varint 0x0c01 + truncate
    multicodec = bytes([0x0c, 0x01])
    encoded    = _b58encode(multicodec + digest)
    return f"did:key:z{encoded}"

def did_to_short(did: str) -> str:
    return did[:20] + "…" + did[-8:]
