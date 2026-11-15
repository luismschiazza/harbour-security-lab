# Harbour Security Lab

A small, auditable laboratory for **authorized, non-destructive** connectivity and integration-service checks, kept separate from future analysis of fictitious Harbour/DBF copies.

## Current scope

Checkpoint 3 implements strict configuration validation, exact endpoint authorization, pinned-address TCP, bounded GET checks, sanitized JSON/Markdown evidence, and offline/loopback tests. **The executable profile accepts only `localhost` / `127.0.0.1`. Remote execution is deliberately blocked.**

No scanners, discovery, brute force, denial-of-service tooling, production DBF access, native Harbour modifications, or automatic HTTP redirects are included. An API finding is not evidence of a Harbour vulnerability.

The owner has authorized public distribution under the MIT license. The approved repository is [luismschiazza/harbour-security-lab](https://github.com/luismschiazza/harbour-security-lab). Publication requires the exact public-file inventory and staged Git content to pass review; historical local reports are never included.

## Requirements and installation

- Node.js 24 or newer; development validation targets Node 24.
- Project-local TypeScript and Node type declarations; no global compiler required.
- No runtime npm dependencies. `undici-types` is a transitive development-only type dependency.
- Python 3.11+ is proposed for the independent validator; it has not been installed or execution-validated as part of this checkpoint.

From the project root:

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run review:public
```

`npm run validate:local` runs these validation scripts and writes sanitized JSON/Markdown evidence for each command. It exits with code 2 if publication review is blocked, even if typecheck/build/tests pass. It does not install packages or publish anything.

`.npmrc` keeps npm's cache inside the project, disables dependency lifecycle scripts and avoids audit/funding requests. Installation itself downloads the locked development packages. `npm test` builds and runs Node's standard test runner with coverage. Tests start temporary listeners **only on `127.0.0.1`**, using OS-assigned fixture ports, and do not require another machine or Tailscale.

Tests retain generated files in ignored `config/cp3-test.local.*` directories rather than deleting evidence. The output-safety fixture creates a local junction/symlink; Linux supports it normally, and Windows uses a directory junction.

## Modules

| Directory | Responsibility |
| --- | --- |
| `src/network/` | Host/IP/port parsing, mandatory scope checks, bounded resolver abstraction, numeric-address TCP |
| `src/security/` | HTTP audit contracts and one bounded GET with status/type/size validation |
| `src/reporting/` | Unique run IDs, recursive redaction, safe Markdown, exclusive file creation |
| `src/dbf/` | Read-only fictitious-copy review contracts only; no DBF implementation |
| `python/` | Independent standard-library loopback validator and prepared unit tests |
| `tests/` | Offline mocks, negative authorization tests and loopback integration |
| `scripts/` | Allowlisted public-file review; not a publication command |

See [architecture](docs/architecture.md), [configuration](config/README.md), [tests](tests/README.md), [contributing](CONTRIBUTING.md), and [security policy](SECURITY.md).

## Running an explicitly approved local probe

Do not enable execution merely because a target is reachable. Obtain operator approval for the exact fixture and individual ports first. The reference is an audit trail, not an authentication mechanism.

Copy `.env.example` to an ignored `.env` only if needed, then fill the required local scope as described in [configuration](config/README.md). Build before running:

```sh
node --env-file=.env dist/cli.js
```

Alternatively, supply environment variables through the shell and run `npm run probe`. With no complete grant, execution is blocked **before** DNS or a socket is opened. Exit codes: `0` success, `2` blocked/check failure, `1` output/unexpected top-level error. The CLI writes sanitized evidence and prints only the run ID and status, not a machine name or endpoint.

The CLI probes approved TCP ports sequentially, with no retries. `localhost` is a local alias mapped to `127.0.0.1`; it does not issue upstream DNS queries. Resolver answer validation, deadline/error handling and out-of-scope answers are exercised with injected offline mocks. A real remote DNS transport is intentionally deferred pending separate authorization.

## Evidence and privacy

Exports go to `evidence/<run-id>.json` and `reports/<run-id>.md` with exclusive creation. Existing files are never overwritten; if the second file fails, the first remains as partial evidence. Runtime errors contain allowlisted codes, not raw exception messages.

Redaction covers credential fields, known secret values supplied by the caller, authentication strings, common token formats, URLs, IP literals, emails, paths, and machine/target identity fields. HTTP bodies and remote headers are not retained. Markdown values are escaped.

**Redaction is defense in depth, not a complete DLP system.** Arbitrary personal names, unusual encodings or unknown secrets may not be recognized. Do not pass sensitive payloads; manually review any export before sharing. File modes do not replace Windows ACL review. Exclusive writes/path checks are not an OS sandbox against a privileged local process racing filesystem changes.

Historical environment reports and local evidence are excluded from publication and preserved locally. No real DBF, FPT, DBT, CDX or NTX files belong in the repository.

## Independent Python validator

Only after confirming an existing approved Python interpreter:

```sh
python -m unittest discover -s python -p "test_*.py"
python python/connectivity.py
```

It reads the same loopback environment grant, opens its own numeric-address TCP connections, and emits sanitized JSON to stdout. It does not call Node or use external packages. Python tests are prepared but **not yet executed**; the CI workflow currently validates Node only. Compare outcome classifications, not identical durations: these are separate measurements at different instants.

## Open-source readiness

`npm run review:public` reads the exact allowlist in `config/public-files.json`, checks candidate content/paths and prints SHA-256 digests. If Git has been initialized in this root, it also checks the tracked list against the allowlist. No `git add`, commit, push, remote creation or publication is performed.

The review blocks on unresolved license ownership and obvious sensitive findings. It is not a substitute for human review, secret scanning, dependency analysis or legal review. `private: true` prevents accidental npm publication; it does not prevent a future approved GitHub release.

## License

[MIT](LICENSE) — Copyright (c) 2026 Luís Miguel Schiazza. Copyright holder and year were confirmed by the owner.
