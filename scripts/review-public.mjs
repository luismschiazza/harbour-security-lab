import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Local, read-only candidate review. Never adds, commits, publishes or prints matched secrets. */
export function reviewPublic(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/public-files.json'), 'utf8'));
  if (!Array.isArray(manifest.files) || new Set(manifest.files).size !== manifest.files.length) {
    throw new Error('INVALID_PUBLIC_MANIFEST');
  }
  const findings = [];
  const inventory = [];
  const reviewedSyntheticLiterals = new Map([
    ['tests/reporting.test.mjs', [['https:', '//user:pass@example.invalid/?token=fixture-url'].join('')]],
    ['tests/config-cli.test.mjs', [['https:', '//user:password@example.invalid/'].join('')]],
  ]);
  let reviewedSyntheticFixtureCount = 0;
  for (const relative of manifest.files) {
    if (typeof relative !== 'string' || !/^[a-z0-9_./-]+$/iu.test(relative)
        || relative.split('/').some((segment) => segment === '..' || segment === '' || segment === '.')) {
      throw new Error('INVALID_PUBLIC_PATH');
    }
    if (/\.(?:dbf|fpt|dbt|cdx|ntx|pem|key|pfx|p12)$/iu.test(relative)
        || relative === '.env' || relative.startsWith('reports/')
        || (relative.startsWith('evidence/') && relative !== 'evidence/README.md')
        || relative.includes('.local.') || relative.startsWith('node_modules/') || relative.startsWith('dist/')) {
      findings.push({ file: relative, code: 'FORBIDDEN_PUBLIC_PATH' });
      continue;
    }
    let current = root;
    let unsafe = false;
    for (const segment of relative.split('/')) {
      current = path.join(current, segment);
      if (!fs.existsSync(current) || fs.lstatSync(current).isSymbolicLink()) { unsafe = true; break; }
    }
    if (unsafe || !fs.statSync(current).isFile()) {
      findings.push({ file: relative, code: 'MISSING_OR_LINKED_FILE' }); continue;
    }
    const bytes = fs.readFileSync(current);
    const text = bytes.toString('utf8');
    inventory.push({ file: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    if (relative === 'LICENSE' && text.includes('_PENDING_CONFIRMATION')) {
      findings.push({ file: relative, code: 'COPYRIGHT_OWNER_AND_YEAR_REQUIRED' });
    }
    let credentialText = text;
    for (const literal of reviewedSyntheticLiterals.get(relative) ?? []) {
      if (credentialText.includes(literal)) reviewedSyntheticFixtureCount++;
      credentialText = credentialText.split(literal).join('[REVIEWED_SYNTHETIC_FIXTURE]');
    }
    if (/\b(?:gh[pousr]_[a-z0-9]{30,}|github_pat_[a-z0-9_]{40,}|npm_[a-z0-9]{30,})\b/iu.test(credentialText)
        || credentialText.includes('-----BEGIN ' + 'PRIVATE KEY-----') || /https?:\/\/[^\s/@]+:[^\s/@]+@/u.test(credentialText)) {
      findings.push({ file: relative, code: 'POSSIBLE_CREDENTIAL' });
    }
    // Only synthetic test credentials in explicit test/sanitizer sources are expected.
    // A URL credential fixture is deliberately synthetic; classify it for human review instead of publishing a secret.
    const ips = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu) ?? [];
    if (ips.some((ip) => !ip.startsWith('127.') && !ip.startsWith('192.0.2.') && !ip.startsWith('198.51.100.') && !ip.startsWith('203.0.113.'))) {
      findings.push({ file: relative, code: 'NON_DOCUMENTATION_IP_LITERAL' });
    }
    const machine = os.hostname().toLowerCase();
    if ((machine.length >= 4 && text.toLowerCase().includes(machine))
        || text.toLowerCase().includes(root.toLowerCase())
        || /[a-z]:\\(?:users|programa)/iu.test(text)) {
      findings.push({ file: relative, code: 'LOCAL_MACHINE_OR_PATH' });
    }
  }
  let trackedState = 'not-initialized';
  if (fs.existsSync(path.join(root, '.git'))) {
    const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
    if (top.status !== 0 || path.resolve(top.stdout.trim()).toLowerCase() !== path.resolve(root).toLowerCase()) {
      findings.push({ file: '.git', code: 'UNEXPECTED_GIT_ROOT' });
    } else {
      const listed = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
      if (listed.status !== 0) findings.push({ file: '.git', code: 'TRACKED_FILE_REVIEW_FAILED' });
      else {
        trackedState = 'reviewed';
        for (const file of listed.stdout.split(String.fromCharCode(0)).filter(Boolean)) {
          if (!manifest.files.includes(file)) findings.push({ file, code: 'TRACKED_OUTSIDE_PUBLIC_ALLOWLIST' });
        }
      }
    }
  }
  return { schemaVersion: '1.0', status: findings.length === 0 ? 'candidate-review-pass' : 'publication-blocked',
    trackedState, candidateCount: inventory.length, reviewedSyntheticFixtureCount, findings, inventory,
    limitations: ['Heuristic content review, not a comprehensive secret scanner.',
      'Synthetic test credentials require human review.',
      'Human approval and confirmed license ownership remain mandatory before publication.'] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const report = reviewPublic(root);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'candidate-review-pass' ? 0 : 2;
  } catch {
    console.error(JSON.stringify({ status: 'publication-blocked', code: 'REVIEW_FAILED' }));
    process.exitCode = 1;
  }
}
