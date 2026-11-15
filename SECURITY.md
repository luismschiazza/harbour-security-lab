# Security policy

## Status and supported scope

This is an experimental academic tool, not a hardened security product. Development validation targets Node.js 24 and the current loopback-only profile. Python validation is pending. No remote audit, API authentication audit or DBF integrity audit has been completed.

## Reporting a vulnerability

Do not open a public issue containing secrets, private endpoints, machine information or DBF data. Once an approved GitHub repository exists, use GitHub's private vulnerability reporting **only if the owner has enabled it**. Otherwise request a private reporting channel from the owner without including exploit details or sensitive evidence. No verified security email or response SLA has been established.

Include a sanitized description, affected version/component, a local synthetic reproduction, expected/observed behavior, and proposed mitigation if available. Do not test beyond your authorization while investigating.

## Boundaries

- Only explicitly approved `localhost` / `127.0.0.1` endpoints and individual ports are permitted by the current runtime profile.
- DNS-like behavior is injectable for offline tests. No upstream DNS resolver or remote transport is enabled.
- HTTP uses one GET, explicit paths, total request deadline, streaming byte limit and no redirects. It does not implement production authentication testing.
- Evidence excludes HTTP bodies and raw remote headers. Automated redaction has limitations and requires human review.
- Read-only DBF review is planned for fictitious consistent copies only. No guarantee about native Harbour locking is made.
- The library cannot constrain malicious code executing in the same process or a privileged local filesystem adversary. Use OS isolation and restrictive ACLs where required.
- Loopback validation does not prove communication with another machine or security of the Harbour application.

Before publication, confirm license ownership and review the exact public inventory. Historical reports, caches, test artifacts and generated evidence must remain private.
