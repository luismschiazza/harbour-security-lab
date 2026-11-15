# Configuration

The CLI reads environment variables at execution time. There is no automatic `.env` loader. Node's optional `--env-file` flag may be used with a private, ignored file only after operator approval.

`.env.example` is deliberately incomplete and disabled. Set all of the following for an approved local fixture:

- `LAB_NETWORK_ENABLED=true` (exact spelling).
- `LAB_PROFILE=checkpoint3-loopback`.
- `LAB_AUTHORIZATION_REFERENCE` and `LAB_TARGET_LABEL`: 1–64 ASCII letters/digits/underscores/hyphens, starting with a letter/digit; references must not contain secrets or personal names.
- `LAB_TARGET_HOST`: exactly `localhost` or `127.0.0.1`.
- `LAB_TARGET_ADDRESSES=127.0.0.1`.
- `LAB_AUTHORIZED_PORTS`: 1–16 distinct individual decimal ports (1–65535), comma-separated, no spaces or ranges.
- Optional TCP and resolver timeouts: integer milliseconds from 1 to 30000, default 3000.

The compiled runtime validates authorization before resolution/transport and revalidates at transport boundaries. Remote addresses, including alternate loopback addresses and IPv6 loopback, are not enabled by this checkpoint.

`safety-policy.json` documents defaults; it is not loaded as an authorization source. The authoritative runtime policy is `src/network/scope.ts`. Changing this JSON cannot enable remote traffic.

The HTTP library takes explicit arguments: approved paths, expected statuses, resolver/request deadlines and a response limit from 1 byte to 16 MiB. It implements a single GET, not an authentication audit suite.

Output folders are fixed under the selected laboratory root. `.npmrc` configures a project-relative npm cache and disables dependency install scripts, funding/audit requests and update notices. No global configuration is changed.

Local cache and retained test artifacts matching `*.local.*` are ignored. Never force-add them or publish historical reports.
