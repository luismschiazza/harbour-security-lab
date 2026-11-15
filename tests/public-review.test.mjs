import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { reviewPublic } from '../scripts/review-public.mjs';
import { temporaryRoot } from './helpers.mjs';

function fixture(files, contents = {}) {
  const root = temporaryRoot(); mkdirSync(path.join(root, 'config'));
  writeFileSync(path.join(root, 'config', 'public-files.json'), JSON.stringify({ files }));
  for (const [name, content] of Object.entries(contents)) writeFileSync(path.join(root, name), content);
  return root;
}

test('public review reports hashes without adding files to Git', () => {
  const result = reviewPublic(fixture(['README.md'], { 'README.md': 'Synthetic review fixture.' }));
  assert.equal(result.status, 'candidate-review-pass'); assert.equal(result.trackedState, 'not-initialized');
  assert.match(result.inventory[0].sha256, /^[a-f0-9]{64}$/u);
});

test('public review blocks pending license and unapproved files', () => {
  const result = reviewPublic(fixture(['LICENSE', 'fictional.DBF', '.env', 'absent.md'], {
    LICENSE: 'MIT License _PENDING_CONFIRMATION',
  }));
  assert.equal(result.status, 'publication-blocked');
  for (const code of ['COPYRIGHT_OWNER_AND_YEAR_REQUIRED', 'FORBIDDEN_PUBLIC_PATH', 'MISSING_OR_LINKED_FILE']) {
    assert.ok(result.findings.some((item) => item.code === code));
  }
});

test('public review rejects traversal and duplicate manifest paths', () => {
  for (const files of [['../outside'], ['/absolute'], ['README.md', 'README.md']]) {
    assert.throws(() => reviewPublic(fixture(files)));
  }
});

test('public review detects synthetic secret-shaped data without echoing it', () => {
  const fake = 'ghp_' + 'x'.repeat(40);
  const result = reviewPublic(fixture(['README.md'], { 'README.md': fake }));
  assert.equal(result.findings[0].code, 'POSSIBLE_CREDENTIAL');
  assert.ok(!JSON.stringify(result).includes(fake));
});
