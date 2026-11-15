import { request as httpRequest } from 'node:http';
import { performance } from 'node:perf_hooks';
import { resolveAuthorizedHost } from '../network/dns.js';
import type { Resolver } from '../network/dns.js';
import { authorizeAddress, authorizeEndpoint } from '../network/scope.js';
import type { Scope } from '../network/scope.js';
import { boundedInteger, LabError, safeCode } from '../network/validation.js';

export type HttpOutcome = 'accepted' | 'unexpected-status' | 'redirect-blocked' | 'response-too-large'
  | 'timeout' | 'invalid-response' | 'transport-error' | 'blocked';
export interface HttpResult {
  readonly outcome: HttpOutcome;
  readonly statusCode: number | null;
  readonly bytesRead: number;
  readonly durationMs: number;
  readonly errorCode: string | null;
}
export interface HttpCheck {
  readonly scope: Scope;
  readonly host: string;
  readonly port: number;
  readonly path: string;
  readonly approvedPaths: readonly string[];
  readonly expectedStatuses: readonly number[];
  readonly timeoutMs: number;
  readonly dnsTimeoutMs: number;
  readonly maxResponseBytes: number;
}

export function evaluateResponse(status: number, bytes: number, maxBytes: number,
  expectedStatuses: readonly number[], contentType: string): HttpOutcome {
  boundedInteger(maxBytes, 1, 16777216);
  if (!Number.isInteger(status) || status < 100 || status > 599 || !Number.isSafeInteger(bytes) || bytes < 0) return 'invalid-response';
  if (status >= 300 && status <= 399) return 'redirect-blocked';
  if (bytes > maxBytes) return 'response-too-large';
  if (!/^(application\/json|text\/plain)(?:;|$)/iu.test(contentType)) return 'invalid-response';
  return expectedStatuses.includes(status) ? 'accepted' : 'unexpected-status';
}

/** One bounded GET, no credentials, no redirects, no retries, no response body retained. */
export async function checkHttp(input: HttpCheck, resolver?: Resolver, transport: typeof httpRequest = httpRequest): Promise<HttpResult> {
  const start = performance.now();
  const result = (outcome: HttpOutcome, statusCode: number | null, bytesRead: number, errorCode: string | null): HttpResult =>
    ({ outcome, statusCode, bytesRead, errorCode, durationMs: performance.now() - start });
  try {
    // Snapshot caller-owned values before the first await (including allowlists).
    input = { ...input, approvedPaths: Array.isArray(input.approvedPaths) ? [...input.approvedPaths] : [],
      expectedStatuses: Array.isArray(input.expectedStatuses) ? [...input.expectedStatuses] : [] };
    const scope = authorizeEndpoint(input.scope, input.host, input.port);
    boundedInteger(input.timeoutMs, 1, 30000);
    boundedInteger(input.dnsTimeoutMs, 1, 30000);
    boundedInteger(input.maxResponseBytes, 1, 16777216);
    if (!Array.isArray(input.approvedPaths) || input.approvedPaths.length > 16
        || !/^\/[a-z0-9/_-]*$/iu.test(input.path) || input.path.startsWith('//')
        || !input.approvedPaths.includes(input.path)) throw new LabError('PATH_NOT_AUTHORIZED');
    if (!Array.isArray(input.expectedStatuses) || input.expectedStatuses.length === 0 || input.expectedStatuses.length > 16) {
      throw new LabError('INVALID_EXPECTED_STATUS');
    }
    input.expectedStatuses.forEach((status) => boundedInteger(status, 100, 599));
    const resolved = await resolveAuthorizedHost(scope, input.dnsTimeoutMs, resolver);
    const address = resolved.addresses[0];
    if (!address) throw new LabError('DNS_EMPTY_OR_EXCESSIVE');
    authorizeAddress(scope, address);
    return await new Promise<HttpResult>((resolve) => {
      let settled = false;
      let bytes = 0;
      let status: number | null = null;
      const req = transport({ hostname: address, family: 4, port: input.port, method: 'GET',
        path: input.path, headers: { Host: scope.host, Accept: 'application/json, text/plain' }, agent: false });
      const finish = (outcome: HttpOutcome, code: string | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        req.destroy();
        resolve(result(outcome, status, bytes, code));
      };
      const timer = setTimeout(() => finish('timeout', 'ETIMEDOUT'), input.timeoutMs);
      req.on('error', (error) => finish('transport-error', safeCode(error)));
      req.once('response', (response) => {
        status = response.statusCode ?? null;
        response.on('error', (error) => finish('transport-error', safeCode(error)));
        response.once('aborted', () => finish('transport-error', 'RESPONSE_ABORTED'));
        if (status !== null && status >= 300 && status <= 399) {
          finish('redirect-blocked', 'REDIRECT_NOT_AUTHORIZED');
          return;
        }
        const length = response.headers['content-length'];
        if (length !== undefined && (!/^[0-9]+$/u.test(length) || !Number.isSafeInteger(Number(length)))) {
          finish('invalid-response', 'INVALID_CONTENT_LENGTH');
          return;
        }
        if (length !== undefined && Number(length) > input.maxResponseBytes) {
          finish('response-too-large', 'RESPONSE_LIMIT');
          return;
        }
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.byteLength;
          if (bytes > input.maxResponseBytes) finish('response-too-large', 'RESPONSE_LIMIT');
        });
        response.once('end', () => {
          const outcome = evaluateResponse(status ?? 0, bytes, input.maxResponseBytes,
            input.expectedStatuses, response.headers['content-type'] ?? '');
          finish(outcome, null);
        });
      });
      req.end();
    });
  } catch (error) {
    const code = safeCode(error);
    return result(code === 'DNS_TIMEOUT' ? 'timeout'
      : ['ENOTFOUND', 'EAI_AGAIN', 'INTERNAL_ERROR', 'DNS_EMPTY_OR_EXCESSIVE'].includes(code) ? 'transport-error' : 'blocked', null, 0, code);
  }
}
