import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { EventEmitter } from 'node:events';
import { validateHost, validatePort, validatePorts, boundedInteger, safeCode, LabError } from '../dist/network/validation.js';
import { validateScope, authorizeEndpoint, authorizeAddress } from '../dist/network/scope.js';
import { resolveAuthorizedHost, localResolver } from '../dist/network/dns.js';
import { probeTcp, dialTcp, createTcpDialer } from '../dist/network/tcp.js';
import { scope, listen } from './helpers.mjs';

const request = (overrides = {}) => ({ scope: scope(), host: 'localhost', port: 32123,
  connectTimeoutMs: 100, dnsTimeoutMs: 100, ...overrides });
const dial = async () => ({ outcome: 'connected', errorCode: null, durationMs: 1 });

for (const [value, expected] of [['LOCALHOST', 'localhost'], ['api.example.test', 'api.example.test'],
  ['127.0.0.1', '127.0.0.1'], ['2001:db8::1', '2001:db8::1'], ['::1', '::1']]) {
  test(`host normalization: ${value}`, () => assert.equal(validateHost(value), expected));
}
for (const value of ['', null, 'localhost ', 'https://example.test', 'a..test', '-bad.test',
  '127.1', '12345', '0x7f000001', 'fe80::1%eth0', '[::1]', 'bad_name.test', 'x'.repeat(254)]) {
  test(`reject malformed host: ${String(value).slice(0, 30)}`, () => {
    assert.throws(() => validateHost(value));
  });
}

test('port and numeric boundaries reject coercion, ranges and duplicates', () => {
  assert.equal(validatePort(1), 1); assert.equal(validatePort(65535), 65535);
  for (const value of [0, -1, 65536, 1.5, NaN, Infinity, '80', null]) assert.throws(() => validatePort(value));
  for (const value of [[], [80, 80], ['80-90'], Array.from({ length: 17 }, (_, i) => i + 1), null]) assert.throws(() => validatePorts(value));
  assert.deepEqual(validatePorts([80, 443]), [80, 443]);
  assert.throws(() => boundedInteger(undefined, 1, 5));
});

test('scope denies absent/false/incomplete/remote grants', () => {
  for (const input of [null, {}, { ...scope(), enabled: false }, { ...scope(), profile: 'remote' },
    { ...scope(), authorizationReference: '' }, { ...scope(), label: 'bad label' },
    { ...scope(), host: 'example.test' }, { ...scope(), host: '0x7f000001' },
    { ...scope(), host: '::1' }, { ...scope(), addresses: [] },
    { ...scope(), addresses: ['192.0.2.1'] }, { ...scope(), addresses: ['127.0.0.1', '192.0.2.1'] }]) {
    assert.throws(() => validateScope(input));
  }
  assert.ok(Object.isFrozen(validateScope(scope())));
});

test('endpoint and address must match exact authorization', () => {
  assert.equal(authorizeEndpoint(scope(), 'LOCALHOST', 32123).host, 'localhost');
  assert.throws(() => authorizeEndpoint(scope(), '127.0.0.1', 32123));
  assert.throws(() => authorizeEndpoint(scope(), 'localhost', 32124));
  assert.throws(() => authorizeAddress(scope(), '127.0.0.2'));
});

test('invalid authorization blocks before DNS or TCP', async () => {
  let calls = 0;
  const resolver = async () => { calls++; return ['127.0.0.1']; };
  const dialer = async () => { calls++; return dial(); };
  for (const req of [request({ scope: {} }), request({ port: 32124 }), request({ host: 'example.test' }), request({ connectTimeoutMs: 0 })]) {
    const result = await probeTcp(req, { resolver, dialer });
    assert.equal(result.outcome, 'blocked');
  }
  assert.equal(calls, 0);
});

test('numeric IP is pinned and bypasses resolver entirely', async () => {
  const resolved = await resolveAuthorizedHost(scope(32123, '127.0.0.1'), 100, async () => { throw new Error('must not resolve'); });
  assert.deepEqual(resolved.addresses, ['127.0.0.1']); assert.equal(resolved.durationMs, 0);
});

test('local resolver never sends upstream DNS', async () => {
  assert.deepEqual(await localResolver('localhost', new AbortController().signal), ['127.0.0.1']);
  assert.deepEqual(await localResolver('127.0.0.1', new AbortController().signal), ['127.0.0.1']);
  await assert.rejects(localResolver('example.test', new AbortController().signal));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(localResolver('localhost', controller.signal));
});

test('DNS answer outside scope blocks the entire result without dialing', async () => {
  let calls = 0;
  for (const addresses of [['192.0.2.1'], ['127.0.0.1', '192.0.2.1']]) {
    const result = await probeTcp(request(), { resolver: async () => addresses, dialer: async () => { calls++; return dial(); } });
    assert.equal(result.outcome, 'blocked');
  }
  assert.equal(calls, 0);
});

test('DNS duplicates collapse and resolver is aborted after completion', async () => {
  let signal;
  const result = await resolveAuthorizedHost(scope(), 100, async (_host, abort) => { signal = abort; return ['127.0.0.1', '127.0.0.1']; });
  assert.deepEqual(result.addresses, ['127.0.0.1']); assert.equal(signal.aborted, true);
});

test('DNS empty/excessive/errors are classified without exception messages', async () => {
  for (const addresses of [[], Array(17).fill('127.0.0.1')]) {
    assert.equal((await probeTcp(request(), { resolver: async () => addresses })).outcome, 'dns-error');
  }
  const result = await probeTcp(request(), { resolver: async () => { throw Object.assign(new Error('password=fixture-only'), { code: 'ENOTFOUND' }); } });
  assert.equal(result.errorCode, 'ENOTFOUND');
  assert.ok(!JSON.stringify(result).includes('fixture-only'));
});

test('DNS deadline aborts resolver and cannot open a socket', async () => {
  let signal;
  const result = await probeTcp(request({ dnsTimeoutMs: 5 }), {
    resolver: async (_host, abort) => { signal = abort; return new Promise(() => {}); },
    dialer: async () => { assert.fail('must not connect'); },
  });
  assert.equal(result.outcome, 'timeout'); assert.equal(signal.aborted, true);
});

test('mock dialer receives a numeric pinned address, not hostname', async () => {
  const result = await probeTcp(request(), { dialer: async (_scope, address, port, timeout) => {
    assert.equal(address, '127.0.0.1'); assert.equal(port, 32123); assert.equal(timeout, 100); return dial();
  } });
  assert.equal(result.outcome, 'connected'); assert.equal(result.connectDurationMs, 1);
});

for (const outcome of ['refused', 'timeout', 'network-error']) {
  test(`mock TCP classification: ${outcome}`, async () => {
    const result = await probeTcp(request(), { dialer: async () => ({ outcome, errorCode: 'ETIMEDOUT', durationMs: 5 }) });
    assert.equal(result.outcome, outcome);
  });
}

test('dialer exceptions do not echo secrets', async () => {
  const result = await probeTcp(request(), { dialer: async () => { throw new Error('Bearer fixture-secret'); } });
  assert.equal(result.outcome, 'network-error'); assert.equal(result.errorCode, 'INTERNAL_ERROR');
});

test('raw TCP transport also enforces scope', async () => {
  await assert.rejects(dialTcp(scope(), '192.0.2.1', 32123, 100));
  await assert.rejects(dialTcp(scope(), '127.0.0.1', 32124, 100));
  await assert.rejects(dialTcp(scope(), '127.0.0.1', 32123, 0));
});

test('loopback integration establishes and closes real TCP', async (t) => {
  const server = createServer((socket) => { socket.on('error', () => {}); socket.end(); });
  const port = await listen(server, t);
  const result = await probeTcp(request({ scope: scope(port), port }));
  assert.equal(result.outcome, 'connected'); assert.ok(result.connectDurationMs >= 0);
});

for (const [event, expected] of [['connect', 'connected'], ['ECONNREFUSED', 'refused'],
  ['ETIMEDOUT', 'timeout'], ['ECONNRESET', 'network-error'], ['hang', 'timeout'], ['throw', 'network-error']]) {
  test(`socket lifecycle mock: ${event}`, async () => {
    let destroyed = 0;
    const socket = new EventEmitter();
    socket.destroy = () => { destroyed++; };
    socket.connect = (options) => {
      assert.equal(options.host, '127.0.0.1');
      if (event === 'throw') throw new Error('fixture exception');
      if (event === 'hang') return;
      queueMicrotask(() => event === 'connect' ? socket.emit('connect')
        : socket.emit('error', Object.assign(new Error('token=fixture-only'), { code: event })));
    };
    const result = await createTcpDialer(() => socket)(scope(), '127.0.0.1', 32123, 5);
    assert.equal(result.outcome, expected); assert.equal(destroyed, 1);
    // Late errors cannot overwrite a completed result or become unhandled.
    socket.emit('error', new Error('late fixture error')); assert.equal(destroyed, 1);
  });
}

test('request mutation during DNS cannot change the pinned port', async () => {
  const mutable = request();
  const result = await probeTcp(mutable, { resolver: async () => { mutable.port = 32124; return ['127.0.0.1']; },
    dialer: async (_scope, _address, port) => { assert.equal(port, 32123); return dial(); } });
  assert.equal(result.outcome, 'connected');
});

test('safe errors never expose arbitrary OS messages or codes', () => {
  assert.equal(safeCode(new LabError('PROFILE_BLOCKED')), 'PROFILE_BLOCKED');
  assert.equal(safeCode({ code: 'ECONNREFUSED' }), 'ECONNREFUSED');
  for (const input of [null, 'secret', new Error('secret'), { code: 'password=secret' }]) assert.equal(safeCode(input), 'INTERNAL_ERROR');
});
