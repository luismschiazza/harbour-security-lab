"""Prepared offline tests; execution requires a confirmed approved interpreter."""
import json
import unittest
from unittest.mock import patch

from connectivity import Blocked, integer, probe, run, validate_config


def grant():
    return {
        "LAB_NETWORK_ENABLED": "true", "LAB_PROFILE": "checkpoint3-loopback",
        "LAB_AUTHORIZATION_REFERENCE": "cp3-local-approval", "LAB_TARGET_LABEL": "fixture",
        "LAB_TARGET_HOST": "localhost", "LAB_TARGET_ADDRESSES": "127.0.0.1",
        "LAB_AUTHORIZED_PORTS": "32123", "LAB_CONNECT_TIMEOUT_MS": "100",
    }


class ConnectivityTests(unittest.TestCase):
    def test_disabled_blocks_before_socket(self):
        with patch("connectivity.socket.socket") as factory:
            self.assertEqual(run({})["status"], "blocked")
            factory.assert_not_called()

    def test_scope_and_configuration(self):
        self.assertEqual(validate_config(grant())[1], [32123])
        for change in ({"LAB_NETWORK_ENABLED": "false"}, {"LAB_TARGET_HOST": "example.invalid"},
                       {"LAB_TARGET_ADDRESSES": "192.0.2.1"}, {"LAB_AUTHORIZED_PORTS": "80-90"},
                       {"LAB_AUTHORIZED_PORTS": "80,80"}, {"LAB_AUTHORIZATION_REFERENCE": ""}):
            with self.subTest(change=change), self.assertRaises(Blocked):
                validate_config(grant() | change)

    def test_numeric_limits(self):
        self.assertEqual(integer("65535", 65535), 65535)
        for value in ("0", "-1", "65536", " 80", "1e2", ""):
            with self.subTest(value=value), self.assertRaises(Blocked):
                integer(value, 65535)

    def test_probe_revalidates_port(self):
        with patch("connectivity.socket.socket") as factory:
            with self.assertRaises(Blocked):
                probe(grant(), 32124)
            factory.assert_not_called()

    def test_success_is_independent_and_numeric(self):
        with patch("connectivity.socket.socket") as factory:
            result = run(grant())
            factory.return_value.__enter__.return_value.connect.assert_called_once_with(("127.0.0.1", 32123))
            self.assertEqual(result["status"], "pass")
            self.assertNotIn("127.0.0.1", json.dumps(result))

    def test_classified_errors_do_not_echo_messages(self):
        for error, expected in ((ConnectionRefusedError("token=fixture"), "refused"),
                                (TimeoutError("token=fixture"), "timeout"),
                                (OSError("token=fixture"), "network-error")):
            with self.subTest(expected=expected), patch("connectivity.socket.socket") as factory:
                factory.return_value.__enter__.return_value.connect.side_effect = error
                result = run(grant())
                self.assertEqual(result["observedResult"][0]["outcome"], expected)
                self.assertNotIn("token=fixture", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
