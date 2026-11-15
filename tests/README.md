# Local test plan and execution

Run `npm test` after `npm ci`. It builds with the local TypeScript compiler, then uses `node:test`, strict assertions and Node's experimental V8 coverage. No extra test framework is installed.

## Coverage areas

- Host/IP normalization; malformed values, URLs, zones, shorthands and port boundaries.
- Missing/disabled grants, exact endpoints, individual port allowlists, remote-profile rejection.
- Resolver duplicates, mixed/out-of-scope answers, empty/excessive answers, errors, aborts and deadlines.
- Pinned TCP parameters, socket lifecycle, success/refusal/error/timeout and cleanup.
- HTTP metadata mocks, unauthorized paths, DNS rebinding, redirects, content-type/status checks, declared/streamed body limits, truncation, failures and deadlines.
- Input mutation while awaiting resolution.
- Environment parsing and CLI evidence for blocked/approved execution.
- Redaction, Markdown escaping, unique IDs, invalid measurements, exclusive writes, partial pair failure and rejected output junctions/symlinks.
- Real integration fixtures only on `127.0.0.1`: TCP success and HTTP response/limit/redirect/deadline cases.

Fixture ports are assigned by the OS and inserted individually into a grant; there is no port discovery or scan. Documentation addresses/domains appear only in negative tests/mocks and are never contacted. Timers/refusals are mocked when deterministic behavior is needed.

Listeners close in teardown. Test artifacts remain under ignored `config/cp3-test.local.*`; preserving them avoids destructive cleanup. No tests modify Windows networking settings.

## Limits

Coverage measures compiled executable JavaScript, not TypeScript-only contracts, Python, the publication-review script or workflow execution. Python tests are prepared separately but not run. The GitHub Actions workflow is prepared but has not executed remotely. Do not treat high coverage as proof of authorization correctness or absence of vulnerabilities.
