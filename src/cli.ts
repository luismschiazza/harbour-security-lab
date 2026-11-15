import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { configFromEnvironment } from './network/config.js';
import { probeTcp } from './network/tcp.js';
import { safeCode } from './network/validation.js';
import { createEvidence, writeEvidence } from './reporting/evidence.js';
import type { EvidenceRecord } from './reporting/contracts.js';

export async function runProbe(env: Readonly<Record<string, string | undefined>>, root: string): Promise<EvidenceRecord> {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  let status: EvidenceRecord['status'] = 'blocked';
  let observed = 'No connection attempted.';
  let target: EvidenceRecord['authorizedTarget'] = null;
  let errors: EvidenceRecord['errors'] = [];
  try {
    const config = configFromEnvironment(env);
    target = { label: config.scope.label, host: config.scope.host, ports: config.scope.ports,
      authorizationReference: config.scope.authorizationReference };
    const outcomes = [];
    for (const port of config.scope.ports) {
      const result = await probeTcp({ scope: config.scope, host: config.scope.host, port,
        connectTimeoutMs: config.connectTimeoutMs, dnsTimeoutMs: config.dnsTimeoutMs });
      outcomes.push(result);
    }
    status = outcomes.every((result) => result.outcome === 'connected') ? 'pass'
      : outcomes.some((result) => result.outcome === 'blocked') ? 'blocked' : 'fail';
    observed = JSON.stringify(outcomes);
  } catch (error) {
    errors = [{ code: safeCode(error), message: 'Configuration or authorization rejected; raw input omitted.' }];
  }
  const record = createEvidence({ testId: 'TCP-LOOPBACK', component: 'connectivity', startedAt,
    finishedAt: new Date().toISOString(), authorizedTarget: target,
    objective: 'Connect only to explicitly approved loopback endpoints.',
    expectedResult: 'All explicitly approved ports accept TCP, or unauthorized execution is blocked.',
    observedResult: observed, status, durationMs: performance.now() - start, errors });
  writeEvidence(root, record);
  return record;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const record = await runProbe(process.env, root);
    console.log(JSON.stringify({ runId: record.runId, status: record.status }));
    process.exitCode = record.status === 'pass' ? 0 : 2;
  } catch (error) {
    console.error(JSON.stringify({ status: 'error', code: safeCode(error) }));
    process.exitCode = 1;
  }
}
