import { LabError, validateHost, validatePort, validatePorts } from './validation.js';

export interface Scope {
  readonly enabled: true;
  readonly profile: 'checkpoint3-loopback';
  readonly label: string;
  readonly authorizationReference: string;
  readonly host: string;
  readonly ports: readonly number[];
  readonly addresses: readonly string[];
}

/** Runtime validation is repeated at transport boundaries; TypeScript types are not authorization. */
export function validateScope(input: unknown): Scope {
  if (typeof input !== 'object' || input === null) throw new LabError('AUTHORIZATION_REQUIRED');
  const value = input as Record<string, unknown>;
  if (value['enabled'] !== true || value['profile'] !== 'checkpoint3-loopback') {
    throw new LabError('AUTHORIZATION_REQUIRED');
  }
  const reference = value['authorizationReference'];
  const label = value['label'];
  if (typeof reference !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/iu.test(reference)
      || typeof label !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/iu.test(label)) {
    throw new LabError('INVALID_AUTHORIZATION_REFERENCE');
  }
  const host = validateHost(value['host']);
  // Deliberately narrower than generic IP/hostname validation. Remote execution needs a new gate.
  if (host !== '127.0.0.1' && host !== 'localhost') throw new LabError('PROFILE_BLOCKED');
  const addresses = value['addresses'];
  if (!Array.isArray(addresses) || addresses.length !== 1 || addresses[0] !== '127.0.0.1') {
    throw new LabError('ADDRESS_NOT_AUTHORIZED');
  }
  return Object.freeze({
    enabled: true, profile: 'checkpoint3-loopback', label, authorizationReference: reference,
    host, ports: validatePorts(value['ports']), addresses: Object.freeze(['127.0.0.1']),
  });
}

export function authorizeEndpoint(input: unknown, host: unknown, port: unknown): Scope {
  const scope = validateScope(input);
  if (validateHost(host) !== scope.host || !scope.ports.includes(validatePort(port))) {
    throw new LabError('ENDPOINT_NOT_AUTHORIZED');
  }
  return scope;
}

export function authorizeAddress(scope: Scope, address: string): void {
  const validated = validateScope(scope);
  if (address !== '127.0.0.1' || !validated.addresses.includes(address)) {
    throw new LabError('ADDRESS_NOT_AUTHORIZED');
  }
}
