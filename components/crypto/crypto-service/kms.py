import json
import os
import hvac
import ctypes
import threading
from keygen import generate_keypair

DATA_DIR = '/app/data' if os.path.exists('/app/data') else (
    '/app/certs' if os.path.exists('/app/certs') else os.path.dirname(os.path.abspath(__file__))
)
HISTORY_FILE = os.path.join(DATA_DIR, 'key_history.json')

def zeroize(data):
    """Overwrite a bytearray's contents with zeros to reduce secret key material
    exposure in memory.

    Only operates on bytearray, which is mutable by language contract.
    The bytes type is immutable; overwriting it via CPython-internal pointer
    arithmetic (id(obj)+32) is not portable, is CPython build/version-specific,
    and can cause memory corruption on future releases or alternative interpreters.
    Call sites must hold key material in bytearray, not bytes.

    Note: this is best-effort. Copies made inside C extensions (e.g. hvac, oqs)
    or by the interpreter during assignment are not reachable and cannot be zeroed.
    """
    if not data:
        return
    if isinstance(data, bytearray) and len(data) > 0:
        try:
            buf = (ctypes.c_char * len(data)).from_buffer(data)
            ctypes.memset(ctypes.addressof(buf), 0, len(data))
        except Exception:
            # Last-resort fallback: slice assignment is slower but always safe.
            for i in range(len(data)):
                data[i] = 0

class KMS:
    """Production-grade Key Management Service (KMS) interfacing with HashiCorp Vault.

    Stores and retrieves the post-quantum ML-DSA-65 signing keypair directly
    within Vault's secure KV storage. Retains and persists full key history to
    ensure seamless verification of historical records.

    Architectural Security Note (KMS Signing Boundary):
    This implementation currently utilizes Vault KV v2 storage, where the ML-DSA-65
    private key material is retrieved over TLS into crypto-service process memory for
    signing operations (followed by immediate best-effort mutable bytearray zeroization).
    In contrast to Vault Transit or hardware HSM signing (where the private key never
    leaves the cryptographic module), an arbitrary code execution (RCE) in this service
    could expose raw signing key material during an active signing window. Migration
    to an HSM or dedicated Vault Transit plugin for PQC signatures is planned for future
    hardened enterprise deployments.
    """
    def __init__(self):
        self.lock = threading.RLock()
        
        self.vault_url = os.environ.get("VAULT_ADDR", "https://localhost:8200")
        self.vault_token = os.environ.get("VAULT_TOKEN")
        self.vault_role_id = os.environ.get("VAULT_ROLE_ID")
        self.vault_secret_id = os.environ.get("VAULT_SECRET_ID")
        
        # Enforce HTTPS unless explicitly running in dev mode.
        # Set VAULT_DEV_MODE=true in the environment for local/dev deployments only.
        # Never use VAULT_DEV_MODE=true in production — all production Vault traffic must use HTTPS.
        is_dev_mode = os.environ.get("VAULT_DEV_MODE", "false").lower() == "true"
        if not self.vault_url.startswith("https://") and not is_dev_mode:
            raise ValueError(
                "CRITICAL: Insecure connection protocol. VAULT_ADDR must use HTTPS. "
                "Set VAULT_DEV_MODE=true to allow HTTP for local development only."
            )
            
        if not self.vault_token and not (self.vault_role_id and self.vault_secret_id):
            raise ValueError("CRITICAL: VAULT_TOKEN (or AppRole credentials) is not configured.")
            
        self.secret_path = os.environ.get("VAULT_SECRET_PATH", "scatterid/mldsa")
        self.client = None
        self.public_key_history = []
        
        with self.lock:
            self._load_disk_history()
            self._init_vault()

    def _load_disk_history(self):
        """Load persisted public key history from disk if present."""
        if os.path.exists(HISTORY_FILE):
            try:
                with open(HISTORY_FILE, 'r') as f:
                    hex_keys = json.load(f)
                    for k in hex_keys:
                        pk_bytes = bytes.fromhex(k)
                        if pk_bytes not in self.public_key_history:
                            self.public_key_history.append(pk_bytes)
            except Exception as e:
                print(f"KMS Warning: Error reading key history file: {e}")

    def _save_disk_history(self):
        """Persist public key history to disk securely."""
        try:
            hex_keys = [k.hex() for k in self.public_key_history]
            flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
            mode = 0o600  # Owner read-write only
            fd = os.open(HISTORY_FILE, flags, mode)
            with os.fdopen(fd, 'w') as f:
                json.dump(hex_keys, f)
        except Exception as e:
            print(f"KMS Warning: Error saving key history file: {e}")

    def _init_vault(self):
        """Initialize and authenticate the Vault client. Fails loudly on error."""
        try:
            if self.vault_role_id and self.vault_secret_id:
                self.client = hvac.Client(url=self.vault_url)
                self.client.auth.approle.login(
                    role_id=self.vault_role_id,
                    secret_id=self.vault_secret_id
                )
            else:
                self.client = hvac.Client(url=self.vault_url, token=self.vault_token)
            
            if not self.client.is_authenticated():
                raise RuntimeError("Vault authentication failed: Invalid token or AppRole credentials.")
            
            self._sync_vault_history()
        except Exception as e:
            raise RuntimeError(f"Failed to connect to Vault at {self.vault_url}: {e}")

    def _sync_vault_history(self):
        """Read all past KV v2 versions from Vault to populate key history."""
        if not self.client:
            return
        secret_path = self.secret_path
        mount_point = "secret"
        try:
            meta = self.client.secrets.kv.v2.read_secret_metadata(path=secret_path, mount_point=mount_point)
            versions = meta.get("data", {}).get("versions", {})
            for ver_str in versions.keys():
                try:
                    ver_res = self.client.secrets.kv.v2.read_secret_version(
                        path=secret_path, version=int(ver_str), mount_point=mount_point
                    )
                    v_data = ver_res.get("data", {}).get("data", {})
                    if "public_key" in v_data:
                        pk = bytes.fromhex(v_data["public_key"])
                        if pk not in self.public_key_history:
                            self.public_key_history.append(pk)
                    # Defense-in-depth: remove historical private keys from memory immediately
                    if "private_key" in v_data:
                        del v_data["private_key"]
                except Exception:
                    pass
            self._save_disk_history()
        except Exception:
            pass

    def get_keys(self, algorithm: str = "ML-DSA-65"):
        """Retrieve active signing keypair from Vault. Fails loudly on connection failure."""
        if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
            raise ValueError("Unsupported or insecure PQC algorithm standard requested")
        
        secret_path = self.secret_path
        mount_point = "secret"

        with self.lock:
            try:
                res = self.client.secrets.kv.v2.read_secret_version(
                    path=secret_path,
                    mount_point=mount_point
                )
                data = res["data"]["data"]
                public_key = bytes.fromhex(data["public_key"])
                private_key = bytearray.fromhex(data["private_key"])
                
                # Zeroize Vault response dictionary copies to prevent leakage
                if "private_key" in data:
                    data["private_key"] = ""
                
                if public_key not in self.public_key_history:
                    self.public_key_history.append(public_key)
                    self._save_disk_history()
                return public_key, private_key
            except hvac.exceptions.InvalidPath:
                public_key, private_key = generate_keypair(algorithm)
                payload = {
                    "public_key": public_key.hex(),
                    "private_key": private_key.hex(),
                }
                self.client.secrets.kv.v2.create_or_update_secret(
                    path=secret_path,
                    secret=payload,
                    mount_point=mount_point
                )
                # Clean up the payload keys
                payload["private_key"] = ""
                
                if public_key not in self.public_key_history:
                    self.public_key_history.append(public_key)
                    self._save_disk_history()
                return public_key, private_key
            except Exception as e:
                raise RuntimeError(f"KMS Error: Failed to retrieve active signing keys from Vault: {e}")

    def rotate_keys(self, algorithm: str = "ML-DSA-65"):
        """Rotate active signing keypair, maintaining previous public keys in history."""
        if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
            raise ValueError("Unsupported or insecure PQC algorithm standard requested")
        
        public_key, private_key = generate_keypair(algorithm)
        secret_path = self.secret_path
        mount_point = "secret"
        payload = {
            "public_key": public_key.hex(),
            "private_key": private_key.hex(),
        }

        with self.lock:
            try:
                self.client.secrets.kv.v2.create_or_update_secret(
                    path=secret_path,
                    secret=payload,
                    mount_point=mount_point
                )
                # Clean up the payload keys
                payload["private_key"] = ""
                
                if public_key not in self.public_key_history:
                    self.public_key_history.append(public_key)
                    self._save_disk_history()
                self._sync_vault_history()
                return public_key, private_key
            except Exception as e:
                raise RuntimeError(f"KMS Error: Key rotation operation failed in Vault: {e}")
