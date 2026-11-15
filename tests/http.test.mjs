import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { checkHttp, evaluateResponse } from '../dist/security/http.js';
import { scope, listen } from './helpers.mjs';

const input = (overrides = {}) => ({ scope: scope(), host: 'localhost', port: 32123,
  path: '/health', approvedPaths: ['/health'], expectedStatuses: [200], timeoutMs: 100,
  dnsTimeoutMs: 100, maxResponseBytes: 64, ...overrides });
function mockTransport(options = {}) {
  return (connection) => {
    assert.equal(connection.hostname, '127.0.0.1');
    assert.equal(connection.agent, false); assert.equal(connection.method, 'GET');
    const req = new EventEmitter();
    req.destroy = () => {};
    req.end = () => queueMicrotask(() => {
      if (options.requestError) { req.emit('error', options.requestError); return; }
      const response = new EventEmitter();
      response.statusCode = options.status ?? 200;
      response.headers = options.headers ?? { 'content-type': 'application/json' };
      req.emit('response', response);
      if (options.abort) { response.emit('aborted'); return; }
      if (options.responseError) { response.emit('error', new Error('token=fixture')); return; }
      for (const chunk of options.chunks ?? [Buffer.from('{}')]) response.emit('data', chunk);
      response.emit('end');
    });
    return req;
  };
}

test('response evaluator checks status, type, size and redirect policy', () => {
  assert.equal(evaluateResponse(200, 2, 64, [200], 'application/json; charset=utf-8'), 'accepted');
  assert.equal(evaluateResponse(401, 0, 64, [401], 'text/plain'), 'accepted');
  assert.equal(evaluateResponse(500, 2, 64, [200], 'application/json'), 'unexpected-status');
  assert.equal(evaluateResponse(302, 0, 64, [302], 'text/plain'), 'redirect-blocked');
  assert.equal(evaluateResponse(200, 65, 64, [200], 'application/json'), 'response-too-large');
  for (const type of ['', 'application/octet-stream', 'application/x-dbf', 'text/html', 'application/jsonp']) {
    assert.equal(evaluateResponse(200, 2, 64, [200], type), 'invalid-response');
  }
  for (const status of [0, 600, NaN, 200.5]) assert.equal(evaluateResponse(status, 2, 64, [200], 'text/plain'), 'invalid-response');
  for (const size of [-1, Infinity, 1.5]) assert.equal(evaluateResponse(200, size, 64, [200], 'text/plain'), 'invalid-response');
  assert.throws(() => evaluateResponse(200, 2, 0, [200], 'text/plain'));
});

test('bad authorization, paths and limits fail before HTTP transport', async () => {
  let calls = 0;
  for (const options of [ { scope: {} }, { host: 'example.test' }, { port: 32124 },
    { path: '/not-approved' }, { path: '//elsewhere', approvedPaths: ['//elsewhere'] },
    { path: '/%2e%2e/secret', approvedPaths: ['/%2e%2e/secret'] }, { approvedPaths: [] },
    { approvedPaths: null }, { maxResponseBytes: 0 }, { timeoutMs: 0 },
    { expectedStatuses: [] }, { expectedStatuses: [600] } ]) {
    const result = await checkHttp(input(options), undefined, () => { calls++; throw new Error('not expected'); });
    assert.equal(result.outcome, 'blocked');
  }
  assert.equal(calls, 0);
});

test('DNS rebinding response blocks HTTP before transport', async () => {
  const result = await checkHttp(input(), async () => ['127.0.0.1', '192.0.2.1'], () => assert.fail('must not send'));
  assert.equal(result.outcome, 'blocked'); assert.equal(result.errorCode, 'ADDRESS_NOT_AUTHORIZED');
});

test('HTTP mocks accept metadata but never retain payloads or headers', async () => {
  const result = await checkHttp(input(), undefined, mockTransport({
    headers: { 'content-type': 'application/json', 'set-cookie': 'session=fixture-secret' },
    chunks: [Buffer.from('{"secret":"fixture-secret"}')],
  }));
  assert.equal(result.outcome, 'accepted'); assert.equal(result.bytesRead, 27);
  assert.ok(!JSON.stringify(result).includes('fixture-secret'));
});

for (const [name, options, expected] of [
  ['redirect', { status: 307, headers: { location: 'https://example.invalid/private' } }, 'redirect-blocked'],
  ['declared large body', { headers: { 'content-length': '65' } }, 'response-too-large'],
  ['stream exceeds limit', { chunks: [Buffer.alloc(40), Buffer.alloc(40)] }, 'response-too-large'],
  ['invalid length', { headers: { 'content-length': 'invalid' } }, 'invalid-response'],
  ['unsafe length', { headers: { 'content-length': '9999999999999999999' } }, 'invalid-response'],
  ['request error', { requestError: Object.assign(new Error('secret'), { code: 'ECONNREFUSED' }) }, 'transport-error'],
  ['response error', { responseError: true }, 'transport-error'],
  ['truncated response', { abort: true }, 'transport-error'],
  ['unexpected status', { status: 503 }, 'unexpected-status'],
]) {
  test(`HTTP mock: ${name}`, async () => {
    assert.equal((await checkHttp(input(), undefined, mockTransport(options))).outcome, expected);
  });
}

test('HTTP DNS timeout has a bounded result without opening HTTP', async () => {
  const result = await checkHttp(input({ dnsTimeoutMs: 5 }), async () => new Promise(() => {}), () => assert.fail());
  assert.equal(result.outcome, 'timeout');
});

test('HTTP snapshots caller-owned port and path before DNS', async () => {
  const mutable = input();
  const transport = mockTransport();
  const result = await checkHttp(mutable, async () => {
    mutable.port = 32124; mutable.path = '/unapproved'; mutable.approvedPaths.length = 0;
    return ['127.0.0.1'];
  }, (options) => {
    assert.equal(options.port, 32123); assert.equal(options.path, '/health');
    return transport(options);
  });
  assert.equal(result.outcome, 'accepted');
});

test('HTTP transport exceptions are sanitized', async () => {
  const result = await checkHttp(input(), undefined, () => { throw new Error('Bearer fixture-secret'); });
  assert.ok(!JSON.stringify(result).includes('fixture-secret'));
});

test('loopback integration: GET availability, rejection, redirect, size and timeout', async (t) => {
  let count = 0;
  const server = createServer((req, res) => {
    count++;
    if (req.url === '/hang') return;
    if (req.url === '/redirect') { res.writeHead(302, { Location: 'https://example.invalid/' }); res.end(); return; }
    if (req.url === '/large') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('x'.repeat(128)); return; }
    if (req.url === '/download') { res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); res.end('fictional'); return; }
    res.writeHead(req.url === '/unauthorized' ? 401 : 200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
  const port = await listen(server, t);
  for (const [path, expected] of [['/health', 'accepted'], ['/unauthorized', 'unexpected-status'],
    ['/redirect', 'redirect-blocked'], ['/large', 'response-too-large'], ['/download', 'invalid-response'], ['/hang', 'timeout']]) {
    const result = await checkHttp(input({ scope: scope(port), port, path, approvedPaths: [path], timeoutMs: 100 }));
    assert.equal(result.outcome, expected, path);
  }
  assert.equal(count, 6, 'redirects must never generate a follow-up request');
});
