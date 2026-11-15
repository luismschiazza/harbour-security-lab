import { isIP } from 'node:net';

export class LabError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'LabError';
  }
}

export function boundedInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new LabError('INVALID_NUMBER');
  }
  return value;
}

export function validatePort(value: unknown): number {
  return boundedInteger(value, 1, 65535);
}

export function validateHost(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 253 || value !== value.trim()) {
    throw new LabError('INVALID_HOST');
  }
  if (isIP(value) === 4) return value;
  if (isIP(value) === 6 && !value.includes('%')) {
    return new URL(`http://[${value}]/`).hostname.slice(1, -1);
  }
  if (/^[0-9.]+$/u.test(value) || /^0x[0-9a-f]+$/iu.test(value) || value.includes(':')) throw new LabError('INVALID_HOST');
  const labels = value.split('.');
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(label))) {
    throw new LabError('INVALID_HOST');
  }
  return value.toLowerCase();
}

export function validatePorts(value: unknown): readonly number[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) throw new LabError('INVALID_PORTS');
  const ports = value.map((port: unknown) => validatePort(port));
  if (new Set(ports).size !== ports.length) throw new LabError('DUPLICATE_PORT');
  return Object.freeze(ports);
}

export function safeCode(error: unknown): string {
  if (error instanceof LabError) return error.code;
  const code: unknown = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  return typeof code === 'string' && ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT', 'EACCES'].includes(code)
    ? code : 'INTERNAL_ERROR';
}
