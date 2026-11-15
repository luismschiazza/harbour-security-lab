# Local evidence — do not publish generated files

The source contract is `src/reporting/contracts.ts`. Every runtime record includes run/test ID, timestamps, executor alias, authorized scope, objective, expected/observed result, status, duration and sanitized errors. Unknown durations are null, never fabricated zeroes.

Only this README is a public candidate. Historical diagnostics and generated evidence remain local and ignored. Redaction does not authorize publication; review exports manually. Do not collect personal information, raw environment dumps, credentials, authentication headers, response bodies, real DBF contents or peer lists.

Use `not-run` or `blocked` when appropriate. A successful loopback test is not evidence of communication with another machine or of security in Harbour/DBF.

Generated JSON/Markdown uses exclusive UUID-based filenames. Partial evidence is retained rather than overwritten/deleted. Local Checkpoint reports document actual execution, failures and limitations separately from proposed work.
