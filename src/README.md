# Source modules

- `network/validation.ts`: strict host, port and numeric validation; safe error codes.
- `network/scope.ts`: mandatory fail-closed loopback grants and exact endpoint/address checks.
- `network/config.ts`: explicit environment parsing; no implicit `.env` loading.
- `network/dns.ts`: bounded injectable name resolution, whole-answer validation and local-only default.
- `network/tcp.ts`: pinned numeric TCP, absolute deadline, socket cleanup and classified results.
- `security/contracts.ts`: future API audit plans, kept separate from Harbour.
- `security/http.ts`: one bounded, authorized GET; status/type/size checks; no redirects or stored bodies.
- `reporting/contracts.ts`: shared evidence types with explicit component attribution.
- `reporting/sanitize.ts`: bounded recursive redaction and Markdown escaping.
- `reporting/evidence.ts`: run IDs, validation and exclusive JSON/Markdown output.
- `dbf/contracts.ts`: fictitious-copy review contracts only; no file access.
- `cli.ts`: sequential loopback probe and sanitized evidence output.

Types do not replace runtime checks. Configured references are audit metadata, not cryptographic credentials. The current profile cannot authorize remote connections.
