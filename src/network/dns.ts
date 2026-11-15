import { performance } from 'node:perf_hooks';
import { authorizeAddress, validateScope } from './scope.js';
import type { Scope } from './scope.js';
import { boundedInteger, LabError } from './validation.js';

export type Resolver = (host: string, signal: AbortSignal) => Promise<readonly string[]>;

/** Local name resolution only. No upstream DNS query is permitted in this checkpoint. */
export const localResolver: Resolver = async (host, signal) => {
  if (signal.aborted) throw new LabError('DNS_TIMEOUT');
  if (host === 'localhost' || host === '127.0.0.1') return ['127.0.0.1'];
  throw new LabError('PROFILE_BLOCKED');
};

export async function resolveAuthorizedHost(
  input: Scope, timeoutMs: number, resolver: Resolver = localResolver,
): Promise<{ readonly addresses: readonly string[]; readonly durationMs: number }> {
  const scope = validateScope(input);
  boundedInteger(timeoutMs, 1, 30000);
  const start = performance.now();
  if (scope.host === '127.0.0.1') return { addresses: ['127.0.0.1'], durationMs: 0 };
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  try {
    const addresses = await Promise.race([
      Promise.resolve().then(() => resolver(scope.host, controller.signal)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new LabError('DNS_TIMEOUT')); }, timeoutMs);
      }),
    ]);
    if (addresses.length === 0 || addresses.length > 16) throw new LabError('DNS_EMPTY_OR_EXCESSIVE');
    // Reject the WHOLE answer if any address is outside scope; never silently expand it.
    for (const address of addresses) authorizeAddress(scope, address);
    return { addresses: Object.freeze([...new Set(addresses)]), durationMs: performance.now() - start };
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}
