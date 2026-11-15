import { validateScope } from './scope.js';
import type { Scope } from './scope.js';
import { boundedInteger, LabError } from './validation.js';

export interface LabConfig {
  readonly scope: Scope;
  readonly connectTimeoutMs: number;
  readonly dnsTimeoutMs: number;
}
export function envInteger(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (value.length > 10 || !/^[0-9]+$/u.test(value)) throw new LabError('INVALID_NUMBER');
  return boundedInteger(Number(value), 1, max);
}
export function configFromEnvironment(env: Readonly<Record<string, string | undefined>>): LabConfig {
  // Do not use truthiness: the string "false" must never enable the network.
  const ports = env['LAB_AUTHORIZED_PORTS']?.split(',').map((port) => envInteger(port, 0, 65535));
  const scope = validateScope({
    enabled: env['LAB_NETWORK_ENABLED'] === 'true',
    profile: env['LAB_PROFILE'], label: env['LAB_TARGET_LABEL'],
    authorizationReference: env['LAB_AUTHORIZATION_REFERENCE'],
    host: env['LAB_TARGET_HOST'], ports,
    addresses: env['LAB_TARGET_ADDRESSES']?.split(','),
  });
  return { scope, connectTimeoutMs: envInteger(env['LAB_CONNECT_TIMEOUT_MS'], 3000, 30000),
    dnsTimeoutMs: envInteger(env['LAB_DNS_TIMEOUT_MS'], 3000, 30000) };
}
