"""Contratos do validador independente; sem sockets, DNS ou execução de testes.

A implementação futura usará somente a biblioteca padrão. Este módulo não importa
código TypeScript e não precisa de bibliotecas DBF. Tipos não validam autorização.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ConnectivityOutcome = Literal[
    "connected", "refused", "timeout", "dns-error", "blocked", "network-error"
]


@dataclass(frozen=True)
class ConnectivityRequest:
    host: str
    ports: tuple[int, ...]
    authorization_reference: str
    connect_timeout_ms: int
    dns_timeout_ms: int


@dataclass(frozen=True)
class TcpConnectionResult:
    host: str
    resolved_address: str | None
    port: int
    outcome: ConnectivityOutcome
    connect_duration_ms: float | None
    dns_duration_ms: float | None
    error_code: str | None
