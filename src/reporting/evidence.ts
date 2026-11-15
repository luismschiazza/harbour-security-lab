import { randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LabError } from '../network/validation.js';
import type { EvidenceRecord } from './contracts.js';
import { escapeMarkdown, sanitize } from './sanitize.js';

export type EvidenceInput = Omit<EvidenceRecord, 'schemaVersion' | 'runId' | 'executorMachine'>;

export function createEvidence(input: EvidenceInput): EvidenceRecord {
  if (!/^[a-z0-9_-]{1,64}$/iu.test(input.testId)
      || !['environment', 'connectivity', 'integration-api', 'harbour-dbf'].includes(input.component)
      || !['pass', 'fail', 'error', 'blocked', 'not-run'].includes(input.status)
      || !Number.isFinite(Date.parse(input.startedAt)) || !Number.isFinite(Date.parse(input.finishedAt))
      || Date.parse(input.finishedAt) < Date.parse(input.startedAt)
      || (input.durationMs !== null && (!Number.isFinite(input.durationMs) || input.durationMs < 0))) {
    throw new LabError('INVALID_EVIDENCE');
  }
  return { ...input, schemaVersion: '1.0', runId: randomUUID(), executorMachine: 'local-runner' };
}

export function renderMarkdown(record: Record<string, unknown>): string {
  const rows = Object.entries(record).map(([key, value]) =>
    `| ${escapeMarkdown(key)} | ${escapeMarkdown(typeof value === 'object' ? JSON.stringify(value) : value)} |`);
  return ['# Audit evidence', '', '| Field | Value |', '| --- | --- |', ...rows, ''].join('\n');
}

/** Fixed filenames, exclusive creation, no caller-controlled paths or overwrite mode. */
export function writeEvidence(root: string, record: EvidenceRecord, secrets: readonly string[] = []): readonly string[] {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(record.runId)) throw new LabError('INVALID_RUN_ID');
  if (lstatSync(root).isSymbolicLink() || !lstatSync(root).isDirectory()) throw new LabError('UNSAFE_OUTPUT_PATH');
  const base = realpathSync(root);
  const safe = sanitize(record, secrets) as Record<string, unknown>;
  const outputs = [
    { folder: 'evidence', extension: 'json', content: JSON.stringify(safe, null, 2) + '\n' },
    { folder: 'reports', extension: 'md', content: renderMarkdown(safe) },
  ];
  const written: string[] = [];
  for (const output of outputs) {
    const directory = path.join(base, output.folder);
    try { mkdirSync(directory); }
    catch (error) { if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST')) throw error; }
    const stats = lstatSync(directory);
    if (stats.isSymbolicLink() || !stats.isDirectory() || realpathSync(directory) !== directory) {
      throw new LabError('UNSAFE_OUTPUT_PATH');
    }
    const destination = path.join(directory, `${record.runId}.${output.extension}`);
    writeFileSync(destination, output.content, { flag: 'wx', encoding: 'utf8', mode: 0o600 });
    written.push(destination);
  }
  // If the second file fails, retain the first as partial evidence; never delete/overwrite it.
  return written;
}
