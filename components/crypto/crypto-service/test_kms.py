import unittest
from unittest.mock import patch, MagicMock
import hashlib
from kms import zeroize


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


if __name__ == "__main__":
    unittest.main()
