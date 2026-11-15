import { Socket } from 'node:net';
import { performance } from 'node:perf_hooks';
import { resolveAuthorizedHost } from './dns.js';
import type { Resolver } from './dns.js';
import { authorizeAddress, authorizeEndpoint } from './scope.js';
import type { Scope } from './scope.js';
import { boundedInteger, safeCode } from './validation.js';
import type { ConnectivityOutcome, ConnectivityRequest, TcpConnectionResult } from './contracts.js';

export interface DialResult {
  readonly outcome: 'connected' | 'refused' | 'timeout' | 'network-error';
  readonly errorCode: string | null;
  readonly durationMs: number;
}
export type Dialer = (scope: Scope, address: string, port: number, timeoutMs: number) => Promise<DialResult>;

/** Numeric, pinned address only: no second hostname resolution in the socket API. */
export function createTcpDialer(createSocket: () => Socket = () => new Socket()): Dialer {
  return async (input, address, port, timeoutMs) => {
  const scope = authorizeEndpoint(input, input.host, port);
  authorizeAddress(scope, address);
  boundedInteger(timeoutMs, 1, 30000);
  return new Promise<DialResult>((resolve) => {
    const start = performance.now();
    const socket = createSocket();
    let settled = false;
    const finish = (outcome: DialResult['outcome'], errorCode: string | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ outcome, errorCode, durationMs: performance.now() - start });
    };
    const timer = setTimeout(() => finish('timeout', 'ETIMEDOUT'), timeoutMs);
    socket.once('connect', () => finish('connected', null));
    socket.on('error', (error) => {
      const code = safeCode(error);
      finish(code === 'ECONNREFUSED' ? 'refused' : code === 'ETIMEDOUT' ? 'timeout' : 'network-error', code);
    });
    try { socket.connect({ host: address, port, family: 4 }); }
    catch (error) { finish('network-error', safeCode(error)); }
  });
  };
}

export const dialTcp: Dialer = createTcpDialer();

export async function probeTcp(
  request: ConnectivityRequest, dependencies: { readonly resolver?: Resolver; readonly dialer?: Dialer } = {},
): Promise<TcpConnectionResult> {
  let dnsDurationMs: number | null = null;
  let resolvedAddress: string | null = null;
  try {
    request = { ...request };
    const scope = authorizeEndpoint(request.scope, request.host, request.port);
    boundedInteger(request.connectTimeoutMs, 1, 30000);
    boundedInteger(request.dnsTimeoutMs, 1, 30000);
    const resolved = await resolveAuthorizedHost(scope, request.dnsTimeoutMs, dependencies.resolver);
    dnsDurationMs = resolved.durationMs;
    const address = resolved.addresses[0];
    if (!address) throw new Error('unreachable');
    authorizeAddress(scope, address);
    resolvedAddress = address;
    const result = await (dependencies.dialer ?? dialTcp)(scope, address, request.port, request.connectTimeoutMs);
    return { host: scope.host, port: request.port, resolvedAddress, dnsDurationMs,
      connectDurationMs: result.durationMs, outcome: result.outcome, errorCode: result.errorCode };
  } catch (error) {
    const code = safeCode(error);
    const blocked = ['AUTHORIZATION_REQUIRED', 'INVALID_AUTHORIZATION_REFERENCE', 'PROFILE_BLOCKED',
      'ADDRESS_NOT_AUTHORIZED', 'ENDPOINT_NOT_AUTHORIZED', 'INVALID_HOST', 'INVALID_PORTS',
      'INVALID_NUMBER', 'DUPLICATE_PORT'].includes(code);
    const outcome: ConnectivityOutcome = blocked ? 'blocked' : code === 'DNS_TIMEOUT' ? 'timeout'
      : resolvedAddress === null ? 'dns-error' : 'network-error';
    // Do not echo invalid user input or exception messages in results.
    return { host: 'redacted', port: 0, resolvedAddress: null, dnsDurationMs,
      connectDurationMs: null, outcome, errorCode: code };
  }
}
