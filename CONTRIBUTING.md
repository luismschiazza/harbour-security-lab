# Contributing

This laboratory is for explicitly authorized, reproducible, non-destructive testing.

## Development

Use Node.js 24 and project-local dependencies:

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run review:public
```

Add offline negative tests before extending transports. Bind any approved integration fixture exclusively to `127.0.0.1`, record its individual port, and close listeners/sockets in teardown. Prefer deterministic mocks for timeouts, refusal and malformed responses. Do not enable upstream DNS or remote targets through test data.

Python uses only the standard library. Its prepared tests must be executed with a confirmed interpreter before claiming Python validation.

## Scope and privacy

- Do not submit credentials, machine identifiers, private network topology, reports from a real environment or actual DBF/memo/index files.
- Use synthetic payloads and reserved documentation domains/addresses in negative mocks; never connect to them.
- Keep integration API findings separate from Harbour/DBF findings.
- Do not implement discovery, brute force, destructive requests, denial of service or writes to production copies.
- Preserve fail-closed authorization and exact address/port checks. Changing JSON policy documentation must not silently enable runtime behavior.
- Review all tracked paths and the public allowlist before any commit/publication. Never force-add ignored evidence or caches.

## Pull requests

Describe the authorization assumptions, affected component, test commands/results, error cases, privacy impact and any limitations. Coverage is a measurement, not proof of safety. Do not include externally reachable repro targets.

The project is licensed under MIT. Preserve the owner-confirmed copyright notice in `LICENSE`; do not add guessed personal or organizational data.

For vulnerabilities, follow `SECURITY.md` rather than disclosing sensitive evidence publicly.
