import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { createEvidence, writeEvidence, renderMarkdown } from '../dist/reporting/evidence.js';
import { sanitize, sanitizeText, escapeMarkdown } from '../dist/reporting/sanitize.js';
import { temporaryRoot } from './helpers.mjs';

const input = (overrides = {}) => ({ testId: 'TEST-LOCAL', component: 'environment',
  startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:00.001Z',
  authorizedTarget: null, objective: 'Test a local fixture.', expectedResult: 'Safe export.',
  observedResult: 'Complete.', status: 'pass', durationMs: 1, errors: [], ...overrides });

test('evidence IDs are unique and machine identity is pseudonymous', () => {
  const first = createEvidence(input()); const second = createEvidence(input());
  assert.notEqual(first.runId, second.runId); assert.equal(first.executorMachine, 'local-runner');
  assert.equal(first.schemaVersion, '1.0');
});

test('evidence rejects invalid measurements and timestamps', () => {
  for (const fields of [{ startedAt: 'not a date' }, { finishedAt: '' }, { finishedAt: '2025-01-01' }, { status: 'invented' },
    { component: 'unknown' }, { testId: '../../bad' }, { durationMs: NaN }, { durationMs: -1 }]) {
    assert.throws(() => createEvidence(input(fields)));
  }
  assert.equal(createEvidence(input({ durationMs: null })).durationMs, null);
});

test('recursive sanitizer removes credential, target and machine fields', () => {
  const result = sanitize({ password: 'fixture-a', nested: { api_key: 'fixture-b', Authorization: 'fixture-c',
    host: 'fixture-d', executorMachine: 'fixture-e', resolvedAddress: 'fixture-f', copyDirectory: 'fixture-g' } });
  const output = JSON.stringify(result);
  for (const suffix of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) assert.ok(!output.includes(`fixture-${suffix}`));
  assert.equal(result.password, '[REDACTED]');
});

test('free-text sanitization covers URLs, IPs, emails, paths, tokens and known secrets', () => {
  const backslash = String.fromCharCode(92);
  const original = ['https://user:pass@example.invalid/?token=fixture-url', 'Bearer fixture-bearer',
    'Basic Zml4dHVyZQ==', 'password=fixture-password', 'access_token=fixture-access',
    '{"token":"fixture-json"}', 'email@example.invalid', '192.0.2.10', '2001:db8::1', '"[2001:db8::2]:443"',
    `D:${backslash}Users${backslash}fixture-path`, '/home/fixture-home/file',
    'ghp_fixturegithub', 'eyJfixture.payload.signature', 'fixture-known'].join('\n');
  const output = sanitizeText(original, ['fixture-known', '']);
  for (const fragment of ['user:pass', 'fixture-url', 'fixture-bearer', 'Zml4dHVyZQ', 'fixture-password',
    'fixture-access', 'fixture-json', 'email@example.invalid', '192.0.2.10', '2001:db8::1', '2001:db8::2',
    'fixture-path', 'fixture-home', 'fixturegithub', 'eyJfixture', 'fixture-known']) {
    assert.ok(!output.includes(fragment), fragment);
  }
});

test('sanitizer bounds unsupported, recursive and oversized values', () => {
  const loop = {}; loop.self = loop;
  assert.ok(JSON.stringify(sanitize(loop)).includes('DEPTH_LIMIT'));
  assert.equal(sanitize(Infinity), null); assert.equal(sanitize(undefined), '[UNSUPPORTED]');
  assert.equal(sanitizeText('x'.repeat(9000)).length, 8192);
  assert.equal(sanitize(Array(300).fill(true)).length, 256);
});

test('Markdown cannot inject HTML, links, table rows or fences', () => {
  const unsafe = '<script>|[link](https://example.invalid)\n```';
  const escaped = escapeMarkdown(unsafe);
  assert.ok(!escaped.includes('<script>')); assert.ok(!escaped.includes('|'));
  assert.ok(!escaped.includes('[link]')); assert.ok(!escaped.includes('```')); assert.ok(!escaped.includes('\n'));
  const markdown = renderMarkdown({ test: unsafe, nested: { value: null } });
  assert.ok(markdown.startsWith('# Audit evidence')); assert.ok(markdown.includes('nested'));
});

test('exclusive writes create sanitized JSON and Markdown without overwriting', () => {
  const root = temporaryRoot();
  const record = createEvidence(input({ objective: 'Bearer fixture-only-secret',
    authorizedTarget: { host: 'localhost', label: 'fixture', ports: [32123], authorizationReference: 'fixture-ref' } }));
  const files = writeEvidence(root, record);
  assert.equal(files.length, 2);
  for (const filename of files) {
    assert.ok(filename.startsWith(root));
    const text = readFileSync(filename, 'utf8');
    assert.ok(!text.includes('fixture-only-secret')); assert.ok(!text.includes('fixture-ref'));
  }
  assert.equal(JSON.parse(readFileSync(files[0], 'utf8')).status, 'pass');
  const before = readFileSync(files[0], 'utf8');
  assert.throws(() => writeEvidence(root, record), { code: 'EEXIST' });
  assert.equal(readFileSync(files[0], 'utf8'), before);
});

test('invalid run ID cannot become a path traversal', () => {
  assert.throws(() => writeEvidence(temporaryRoot(), { ...createEvidence(input()), runId: '../../outside' }));
});

test('partial pair failure preserves earlier evidence and existing report', () => {
  const root = temporaryRoot(); const record = createEvidence(input());
  mkdirSync(path.join(root, 'reports'));
  const report = path.join(root, 'reports', `${record.runId}.md`);
  writeFileSync(report, 'existing report', { flag: 'wx' });
  assert.throws(() => writeEvidence(root, record), { code: 'EEXIST' });
  assert.equal(readFileSync(report, 'utf8'), 'existing report');
  assert.equal(JSON.parse(readFileSync(path.join(root, 'evidence', `${record.runId}.json`), 'utf8')).runId, record.runId);
});

test('redirected output folders and invalid roots are rejected', () => {
  const root = temporaryRoot(); const outside = temporaryRoot();
  symlinkSync(outside, path.join(root, 'evidence'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => writeEvidence(root, createEvidence(input())), /UNSAFE_OUTPUT_PATH/u);
  const file = path.join(temporaryRoot(), 'not-directory'); writeFileSync(file, 'fixture');
  assert.throws(() => writeEvidence(file, createEvidence(input())), /UNSAFE_OUTPUT_PATH/u);
});
