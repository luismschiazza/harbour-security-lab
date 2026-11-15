"""Independent standard-library-only validator. Checkpoint 3 permits loopback only.

No upstream DNS query, retries, discovery, DBF access, or credential collection.
Importing this module does not execute a probe. Configuration comes from environment.
"""
from __future__ import annotations

import errno
import json
import os
import re
import socket
import time
import uuid
from datetime import datetime, timezone
from typing import Mapping


class Blocked(ValueError):
    pass


def integer(value: str, maximum: int) -> int:
    if len(value) > 10 or re.fullmatch(r"[0-9]+", value, flags=re.ASCII) is None:
        raise Blocked("INVALID_NUMBER")
    result = int(value)
    if not 1 <= result <= maximum:
        raise Blocked("INVALID_NUMBER")
    return result


def validate_config(env: Mapping[str, str]) -> tuple[str, list[int], int, int]:
    if env.get("LAB_NETWORK_ENABLED") != "true" or env.get("LAB_PROFILE") != "checkpoint3-loopback":
        raise Blocked("AUTHORIZATION_REQUIRED")
    for key in ("LAB_AUTHORIZATION_REFERENCE", "LAB_TARGET_LABEL"):
        if re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", env.get(key, ""), flags=re.ASCII | re.IGNORECASE) is None:
            raise Blocked("INVALID_AUTHORIZATION_REFERENCE")
    host = env.get("LAB_TARGET_HOST", "").lower()
    if host not in ("127.0.0.1", "localhost") or env.get("LAB_TARGET_ADDRESSES") != "127.0.0.1":
        raise Blocked("PROFILE_BLOCKED")
    parts = env.get("LAB_AUTHORIZED_PORTS", "").split(",")
    if not 1 <= len(parts) <= 16:
        raise Blocked("INVALID_PORTS")
    ports = [integer(part, 65535) for part in parts]
    if len(set(ports)) != len(ports):
        raise Blocked("DUPLICATE_PORT")
    return host, ports, integer(env.get("LAB_CONNECT_TIMEOUT_MS", "3000"), 30000), integer(env.get("LAB_DNS_TIMEOUT_MS", "3000"), 30000)


def probe(env: Mapping[str, str], port: int) -> dict[str, object]:
    # Revalidate even when called directly, not just from the CLI.
    _host, authorized_ports, timeout_ms, _dns_timeout_ms = validate_config(env)
    if isinstance(port, bool) or not isinstance(port, int) or port not in authorized_ports:
        raise Blocked("ENDPOINT_NOT_AUTHORIZED")
    # Numeric, pinned address. Do not pass hostnames to socket.create_connection.
    started = time.monotonic()
    outcome, code = "connected", None
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
            connection.settimeout(timeout_ms / 1000)
            connection.connect(("127.0.0.1", port))
    except (TimeoutError, socket.timeout):
        outcome, code = "timeout", "ETIMEDOUT"
    except ConnectionRefusedError:
        outcome, code = "refused", "ECONNREFUSED"
    except OSError as error:
        if error.errno in (errno.ECONNREFUSED, 10061):
            outcome, code = "refused", "ECONNREFUSED"
        elif error.errno in (errno.ETIMEDOUT, 10060):
            outcome, code = "timeout", "ETIMEDOUT"
        else:
            outcome, code = "network-error", "NETWORK_ERROR"
    return {"host": "[REDACTED]", "resolvedAddress": "[REDACTED]", "port": port,
            "outcome": outcome, "connectDurationMs": (time.monotonic() - started) * 1000,
            "dnsDurationMs": 0, "errorCode": code}


def run(env: Mapping[str, str]) -> dict[str, object]:
    started_at = datetime.now(timezone.utc).isoformat()
    started = time.monotonic()
    results: list[dict[str, object]] = []
    errors: list[dict[str, str]] = []
    status = "blocked"
    try:
        _host, ports, _timeout_ms, _dns_timeout_ms = validate_config(env)
        # localhost is an explicitly mapped local alias; upstream DNS is disabled.
        results = [probe(env, port) for port in ports]
        status = "pass" if all(result["outcome"] == "connected" for result in results) else "fail"
    except Blocked as error:
        errors = [{"code": str(error), "message": "Configuration rejected; raw input omitted."}]
    return {"schemaVersion": "1.0", "runId": str(uuid.uuid4()), "testId": "PYTHON-TCP-LOOPBACK",
            "component": "connectivity", "startedAt": started_at,
            "finishedAt": datetime.now(timezone.utc).isoformat(), "executorMachine": "local-runner",
            "authorizedTarget": None if status == "blocked" else {"label": "loopback", "host": "[REDACTED]",
                "ports": [result["port"] for result in results], "authorizationReference": "[REDACTED]"},
            "objective": "Independently validate approved loopback TCP endpoints.",
            "expectedResult": "Approved endpoints connect; unauthorized execution is blocked.",
            "observedResult": results, "status": status,
            "durationMs": (time.monotonic() - started) * 1000, "errors": errors}


if __name__ == "__main__":
    evidence = run(os.environ)
    print(json.dumps(evidence, ensure_ascii=True))
    raise SystemExit(0 if evidence["status"] == "pass" else 2)
