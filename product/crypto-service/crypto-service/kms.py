import json
import os
import hvac
from keygen import generate_keypair
from config import get_config

DATA_DIR = '/app/data' if os.path.exists('/app/data') else (
    '/app/certs' if os.path.exists('/app/certs') else os.path.dirname(os.path.abspath(__file__))
)
HISTORY_FILE = os.path.join(DATA_DIR, 'key_history.json')

class KMS:
    """Production-grade Key Management Service (KMS) interfacing with HashiCorp Vault.

    Stores and retrieves the post-quantum ML-DSA-65 signing keypair directly
    within Vault's secure KV storage. Retains and persists full key history to
    ensure seamless verification of historical records.
    """
    def __init__(self):
        self.vault_url = get_config("network.vault_addr", os.environ.get("VAULT_ADDR", "http://localhost:8200"))
        self.vault_token = get_config("security.vault_token", os.environ.get("VAULT_TOKEN", "scatterid-vault-root-token"))
        self.vault_role_id = get_config("security.vault_role_id", os.environ.get("VAULT_ROLE_ID"))
        self.vault_secret_id = get_config("security.vault_secret_id", os.environ.get("VAULT_SECRET_ID"))
        self.secret_path = get_config("security.vault_secret_path", os.environ.get("VAULT_SECRET_PATH", "scatterid/mldsa"))
        self.client = None
        self.fallback_pub = None
        self.fallback_priv = None
        self.public_key_history = []
        self._load_disk_history()
        self._init_vault()

    def _load_disk_history(self):
        """Load persisted public key history from disk if present."""
        if os.path.exists(HISTORY_FILE) and os.path.getsize(HISTORY_FILE) > 0:
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
            try:
                with os.fdopen(fd, 'w') as f:
                    json.dump(hex_keys, f)
            except Exception:
                try:
                    os.close(fd)
                except Exception:
                    pass
                raise
        except Exception as e:
            print(f"KMS Warning: Error saving key history file: {e}")

    def _init_vault(self):
        """Initialize and authenticate the Vault client."""
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
                print("KMS Warning: Vault authentication failed. Using in-memory keypair fallback.")
                self.client = None
            else:
                self._sync_vault_history()
        except Exception as e:
            print(f"KMS Warning: Failed to connect to Vault at {self.vault_url}: {e}. Using in-memory fallback.")
            self.client = None

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
                except Exception:
                    pass
            self._save_disk_history()
        except Exception:
            pass

    def get_keys(self, algorithm: str = "ML-DSA-65"):
        """Retrieve active signing keypair, or generate if not present."""
        if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
            raise ValueError("Unsupported or insecure PQC algorithm standard requested")
        if not self.client:
            if not self.fallback_pub:
                self.fallback_pub, self.fallback_priv = generate_keypair(algorithm)
                if self.fallback_pub not in self.public_key_history:
                    self.public_key_history.append(self.fallback_pub)
                    self._save_disk_history()
            return self.fallback_pub, self.fallback_priv

        secret_path = self.secret_path
        mount_point = "secret"

        try:
            res = self.client.secrets.kv.v2.read_secret_version(
                path=secret_path,
                mount_point=mount_point
            )
            data = res["data"]["data"]
            public_key = bytes.fromhex(data["public_key"])
            private_key = bytes.fromhex(data["private_key"])
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
            try:
                self.client.secrets.kv.v2.create_or_update_secret(
                    path=secret_path,
                    secret=payload,
                    mount_point=mount_point
                )
            except Exception as e:
                print(f"KMS Warning: Could not write key to Vault: {e}")
            if public_key not in self.public_key_history:
                self.public_key_history.append(public_key)
                self._save_disk_history()
            return public_key, private_key
        except Exception as e:
            print(f"KMS Warning: Vault error ({e}), falling back to in-memory keypair.")
            if not self.fallback_pub:
                self.fallback_pub, self.fallback_priv = generate_keypair(algorithm)
                if self.fallback_pub not in self.public_key_history:
                    self.public_key_history.append(self.fallback_pub)
                    self._save_disk_history()
            return self.fallback_pub, self.fallback_priv

    def rotate_keys(self, algorithm: str = "ML-DSA-65"):
        """Rotate active signing keypair, maintaining previous public keys in history."""
        if algorithm not in ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]:
            raise ValueError("Unsupported or insecure PQC algorithm standard requested")
        public_key, private_key = generate_keypair(algorithm)

        if public_key not in self.public_key_history:
            self.public_key_history.append(public_key)
            self._save_disk_history()

        if not self.client:
            self.fallback_pub = public_key
            self.fallback_priv = private_key
            return public_key, private_key

        secret_path = self.secret_path
        mount_point = "secret"
        payload = {
            "public_key": public_key.hex(),
            "private_key": private_key.hex(),
        }

        try:
            self.client.secrets.kv.v2.create_or_update_secret(
                path=secret_path,
                secret=payload,
                mount_point=mount_point
            )
            self._sync_vault_history()
        except Exception as e:
            print(f"KMS Warning: Vault write failed during rotation: {e}")
            self.fallback_pub = public_key
            self.fallback_priv = private_key

        return public_key, private_key
