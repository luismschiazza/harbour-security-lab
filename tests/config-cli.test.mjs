import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { configFromEnvironment, envInteger } from '../dist/network/config.js';
import { runProbe } from '../dist/cli.js';
import { env, listen, temporaryRoot } from './helpers.mjs';

test('configuration denies missing, false or malformed authorization', () => {
  for (const value of [{}, { ...env(), LAB_NETWORK_ENABLED: 'false' }, { ...env(), LAB_NETWORK_ENABLED: 'TRUE' },
    { ...env(), LAB_AUTHORIZATION_REFERENCE: undefined }, { ...env(), LAB_TARGET_ADDRESSES: undefined },
    { ...env(), LAB_AUTHORIZED_PORTS: undefined }, { ...env(), LAB_AUTHORIZED_PORTS: '80-90' },
    { ...env(), LAB_TARGET_HOST: 'example.invalid' }]) assert.throws(() => configFromEnvironment(value));
});

test('configuration numeric parsing rejects whitespace, zero and large deadlines', () => {
  assert.equal(envInteger(undefined, 3000, 30000), 3000);
  assert.equal(envInteger('10', 3000, 30000), 10);
  for (const value of ['', ' 10', '+10', '0', '30001', '1e2']) assert.throws(() => envInteger(value, 3000, 30000));
  assert.deepEqual(configFromEnvironment(env()).scope.ports, [32123]);
  assert.equal(configFromEnvironment({ ...env(), LAB_CONNECT_TIMEOUT_MS: undefined }).connectTimeoutMs, 3000);
});

test('blocked run writes structured evidence without network or input leaks', async () => {
  const root = temporaryRoot();
  const result = await runProbe({ LAB_TARGET_HOST: 'https://user:password@example.invalid/' }, root);
  assert.equal(result.status, 'blocked'); assert.equal(result.authorizedTarget, null);
  assert.equal(result.errors.length, 1);
  const names = readdirSync(path.join(root, 'evidence')); assert.equal(names.length, 1);
  const saved = readFileSync(path.join(root, 'evidence', names[0]), 'utf8');
  assert.ok(!saved.includes('user:password')); assert.equal(JSON.parse(saved).status, 'blocked');
});

test('loopback CLI integration emits target-aware sanitized evidence', async (t) => {
  const server = createServer((socket) => { socket.on('error', () => {}); socket.end(); });
  const port = await listen(server, t); const root = temporaryRoot();
  const result = await runProbe(env(port), root);
  assert.equal(result.status, 'pass'); assert.deepEqual(result.authorizedTarget.ports, [port]);
  const filename = path.join(root, 'evidence', `${result.runId}.json`);
  const exported = JSON.parse(readFileSync(filename, 'utf8'));
  assert.equal(exported.authorizedTarget.host, '[REDACTED]');
  assert.equal(exported.executorMachine, '[REDACTED]');
});
