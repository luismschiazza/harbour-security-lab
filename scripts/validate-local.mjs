import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

// Run through npm run validate:local, so the currently selected npm CLI is explicit.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
if (!npmCli || !path.isAbsolute(npmCli)) throw new Error('RUN_THROUGH_NPM');
const runs = [];
for (const script of ['typecheck', 'build', 'test', 'review:public']) {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const child = spawnSync(process.execPath, [npmCli, 'run', script], {
    cwd: root, env: process.env, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 120000,
  });
  const finishedAt = new Date().toISOString();
  const durationMs = performance.now() - start;
  const output = child.stdout ?? '';
  // Do not persist raw command output: npm failures may include private absolute paths.
  const tests = output.match(/tests\s+(\d+)/u)?.[1];
  const coverage = output.split('\n').find((line) => line.includes('all files'))?.split('|').slice(1, 4).map((v) => Number(v.trim()));
  let review;
  if (script === 'review:public') {
    const startJson = output.indexOf('{');
    try { review = JSON.parse(output.slice(startJson)); } catch { /* recorded as command failure */ }
  }
  runs.push({ script, startedAt, finishedAt, durationMs, exitCode: child.status,
    status: child.status === 0 ? 'pass' : script === 'review:public' && child.status === 2 ? 'blocked' : 'error',
    ...(tests ? { testCount: Number(tests) } : {}), ...(coverage ? { coveragePercent: { lines: coverage[0], branches: coverage[1], functions: coverage[2] } } : {}),
    ...(review ? { publicReview: review } : {}),
  });
  console.log(JSON.stringify({ command: `npm run ${script}`, exitCode: child.status }));
  if (script !== 'review:public' && child.status !== 0) break;
}
const { createEvidence, writeEvidence } = await import(pathToFileURL(path.join(root, 'dist/reporting/evidence.js')).href);
for (const run of runs) {
  const record = createEvidence({ testId: `CP3-${run.script.replaceAll(':', '-').toUpperCase()}`,
    component: 'environment', startedAt: run.startedAt, finishedAt: run.finishedAt,
    authorizedTarget: null, objective: `Validate local project: npm run ${run.script}.`,
    expectedResult: 'Command succeeds without unauthorized network tests or publication.',
    observedResult: JSON.stringify({ ...run, publicReview: run.publicReview ? {
      status: run.publicReview.status, candidateCount: run.publicReview.candidateCount,
      findings: run.publicReview.findings } : undefined }),
    metadata: run.publicReview ? { publicReview: run.publicReview } : {},
    status: run.status, durationMs: run.durationMs,
    errors: run.status === 'error' ? [{ code: 'LOCAL_COMMAND_FAILED', message: 'Raw subprocess output intentionally omitted.' }] : [],
  });
  writeEvidence(root, record);
  console.log(JSON.stringify({ testId: record.testId, runId: record.runId, status: record.status }));
}
process.exitCode = runs.some((run) => run.status === 'error') ? 1 : runs.some((run) => run.status === 'blocked') ? 2 : 0;
