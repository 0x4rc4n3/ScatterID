import os
import unittest
from unittest.mock import patch, MagicMock
import hashlib
from kms import zeroize, KMS


class TestZeroize(unittest.TestCase):
    def test_zeroize_bytearray(self):
        """zeroize() should clear a bytearray to all zeros."""
        buf = bytearray(b"\xde\xad\xbe\xef" * 8)
        zeroize(buf)
        self.assertTrue(all(b == 0 for b in buf), "bytearray should be zeroed after zeroize()")

    def test_zeroize_empty_bytearray(self):
        """zeroize() on empty bytearray should not raise."""
        zeroize(bytearray())

    def test_zeroize_none(self):
        """zeroize() on None should not raise."""
        zeroize(None)

    def test_zeroize_empty_bytes(self):
        """zeroize() on empty bytes should not raise."""
        zeroize(b"")


class TestKMSAppRoleEnforcement(unittest.TestCase):
    def setUp(self):
        self.original_env = dict(os.environ)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.original_env)

    def test_production_rejects_ambient_vault_token(self):
        """In production (VAULT_DEV_MODE=false), setting only VAULT_TOKEN must raise ValueError."""
        os.environ["VAULT_DEV_MODE"] = "false"
        os.environ["VAULT_ADDR"] = "https://vault.scatterid.com:8200"
        os.environ["VAULT_TOKEN"] = "root-token-that-must-be-rejected"
        os.environ.pop("VAULT_ROLE_ID", None)
        os.environ.pop("VAULT_SECRET_ID", None)

        with self.assertRaises(ValueError) as ctx:
            KMS()
        self.assertIn("Ambient VAULT_TOKEN is forbidden in production", str(ctx.exception))

    def test_production_rejects_missing_credentials(self):
        """In production, missing AppRole credentials must raise ValueError."""
        os.environ["VAULT_DEV_MODE"] = "false"
        os.environ["VAULT_ADDR"] = "https://vault.scatterid.com:8200"
        os.environ.pop("VAULT_TOKEN", None)
        os.environ.pop("VAULT_ROLE_ID", None)
        os.environ.pop("VAULT_SECRET_ID", None)

        with self.assertRaises(ValueError) as ctx:
            KMS()
        self.assertIn("Vault AppRole", str(ctx.exception))

    def test_production_rejects_insecure_http(self):
        """In production, VAULT_ADDR with http:// must raise ValueError."""
        os.environ["VAULT_DEV_MODE"] = "false"
        os.environ["VAULT_ADDR"] = "http://vault.scatterid.com:8200"
        os.environ["VAULT_ROLE_ID"] = "test-role-id"
        os.environ["VAULT_SECRET_ID"] = "test-secret-id"

        with self.assertRaises(ValueError) as ctx:
            KMS()
        self.assertIn("CRITICAL: Insecure connection protocol", str(ctx.exception))

    @patch("hvac.Client")
    def test_production_succeeds_with_approle(self, mock_hvac_client):
        """In production with AppRole credentials and HTTPS, KMS initializes and logs in via AppRole."""
        os.environ["VAULT_DEV_MODE"] = "false"
        os.environ["VAULT_ADDR"] = "https://vault.scatterid.com:8200"
        os.environ["VAULT_ROLE_ID"] = "valid-role-id"
        os.environ["VAULT_SECRET_ID"] = "valid-secret-id"
        os.environ.pop("VAULT_TOKEN", None)

        mock_inst = MagicMock()
        mock_inst.is_authenticated.return_value = True
        mock_inst.secrets.kv.v2.read_secret_metadata.return_value = {"data": {"versions": {}}}
        mock_hvac_client.return_value = mock_inst

        kms = KMS()
        self.assertIsNotNone(kms.client)
        mock_inst.auth.approle.login.assert_called_once_with(
            role_id="valid-role-id",
            secret_id="valid-secret-id"
        )

    @patch("hvac.Client")
    def test_dev_mode_allows_vault_token(self, mock_hvac_client):
        """In dev mode (VAULT_DEV_MODE=true), ambient VAULT_TOKEN and HTTP are accepted."""
        os.environ["VAULT_DEV_MODE"] = "true"
        os.environ["VAULT_ADDR"] = "http://127.0.0.1:8200"
        os.environ["VAULT_TOKEN"] = "dev-token"
        os.environ.pop("VAULT_ROLE_ID", None)
        os.environ.pop("VAULT_SECRET_ID", None)

        mock_inst = MagicMock()
        mock_inst.is_authenticated.return_value = True
        mock_inst.secrets.kv.v2.read_secret_metadata.return_value = {"data": {"versions": {}}}
        mock_hvac_client.return_value = mock_inst

        kms = KMS()
        self.assertIsNotNone(kms.client)
        mock_hvac_client.assert_called_once_with(url="http://127.0.0.1:8200", token="dev-token")

    @patch("hvac.Client")
    def test_renew_token(self, mock_hvac_client):
        """renew_token calls renew_self with specified increment."""
        os.environ["VAULT_DEV_MODE"] = "true"
        os.environ["VAULT_ADDR"] = "http://127.0.0.1:8200"
        os.environ["VAULT_TOKEN"] = "dev-token"

        mock_inst = MagicMock()
        mock_inst.is_authenticated.return_value = True
        mock_inst.secrets.kv.v2.read_secret_metadata.return_value = {"data": {"versions": {}}}
        mock_hvac_client.return_value = mock_inst

        kms = KMS()
        res = kms.renew_token(7200)
        self.assertTrue(res)
        mock_inst.auth.token.renew_self.assert_called_once_with(increment=7200)


if __name__ == "__main__":
    unittest.main()
