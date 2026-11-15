# Architecture and authorization gates

## Components

- **Connectivity**: validate configuration and exact host/ports before resolving or connecting. Snapshot caller-owned inputs, validate every resolver answer, and pass only a pinned numeric address to the socket.
- **Integration API**: inspect bounded HTTP metadata without retaining bodies or raw headers. Reject redirects, unapproved paths and binary/download content types. Authentication and malformed-request suites remain future work.
- **Harbour/DBF**: contracts only. Future analysis must use consistent fictitious copies, preserve read-only access, examine indexes/memos and deleted flags, and avoid assuming Python reproduces native Harbour locking.
- **Reporting**: unique identifiers, timestamps, monotonic measurements, sanitized output and exclusive creation. Preserve component attribution.
- **Python**: independent standard-library implementation; execution not yet validated.

## Current gate: checkpoint3-loopback

Runtime grants require an exact enabled flag, profile, non-secret reference/label, one approved address and distinct individual ports. Only `localhost` and `127.0.0.1` are allowed as hosts, and only `127.0.0.1` as the numeric address. Remote targets and IPv6 loopback are intentionally unavailable.

Generic host parsing understands IPv4/IPv6 and ASCII DNS labels, but parsing does not authorize a target. URLs, whitespace, ambiguous numeric shorthands, zones and malformed labels are rejected. The narrower profile check runs before any resolver or transport.

`localhost` is resolved locally without an upstream query. The resolver abstraction has an abort signal, deadline, answer-count limit and whole-answer scope validation. Offline mocks cover out-of-scope/mixed answers and deadlines. No remote DNS transport is implemented in this checkpoint; enabling one requires a new reviewed gate rather than an environment switch.

TCP opens a numeric-address connection with an absolute deadline, destroys the socket on completion and emits only allowlisted error codes. The CLI operates sequentially, without retries. Public library calls can be orchestrated by a caller; the library is not a process-wide concurrency sandbox.

HTTP snapshots settings before awaiting resolution. It sends one GET to a numeric address, never follows Location, enforces approved paths/status configuration, rejects excessive declared Content-Length, cancels after streaming beyond the byte cap, and ends on an absolute request deadline. DNS has its own preceding deadline. The stream may deliver one chunk beyond the configured limit before cancellation; the body is never accumulated or exported. Compressed bodies are not decompressed.

## Evidence

Each evidence record identifies its test/run, component, executor alias, authorized target, objective, expected/observed result, status, timestamps, duration and relevant errors. Unknown durations are null. Machine identity, target identity and authorization references are redacted on export.

JSON and Markdown filenames derive only from a validated generated UUID. Output directories are fixed under the supplied trusted lab root. Existing files are preserved using exclusive creation; no rollback deletes partial evidence. Symlink/junction output folders are rejected, but this is not a defense against a privileged filesystem race or hostile same-process code.

Automatic redaction is bounded and heuristic. It does not guarantee removal of arbitrary names or novel secret encodings. Do not pass sensitive raw data and require human review before sharing.

## Remaining gates

- **Checkpoint 3**: Node implementation/tests executed locally; MIT holder/year confirmed by the owner. Publication requires a clean candidate and staged-index review. Python execution remains pending.
- **Checkpoint 4**: remote communication blocked until separately authorized host/addresses/ports, Tailscale decisions and a reviewed remote profile/DNS implementation.
- **Checkpoint 5**: API authentication/error cases and fictitious DBF analysis require explicit scope, a running service/copies and separate tests.
- **Checkpoint 6**: academic consolidation must use actual evidence, not anticipated findings.

Publication never implies authorization to audit a remote target. No real production files or local topology should enter the public repository.
