import { isIP } from 'node:net';

const sensitiveKey = /password|passwd|token|secret|authorization|cookie|api[-_]?key|credential|executorMachine|resolvedAddress|^host$|copyDirectory/iu;

export function sanitizeText(input: string, secrets: readonly string[] = []): string {
  let text = input.slice(0, 8192);
  for (const secret of [...secrets].filter((s) => s.length > 0).sort((a, b) => b.length - a.length)) {
    text = text.split(secret).join('[REDACTED]');
  }
  return text
    .replace(/https?:\/\/[^\s<>"']+/giu, '[URL_REDACTED]')
    .replace(/\b(?:Bearer|Basic)\s+[a-z0-9+/_=.-]+/giu, '[AUTH_REDACTED]')
    .replace(/\b(?:password|passwd|access[_-]?token|refresh[_-]?token|token|secret|api[_-]?key|cookie|authorization)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu, '[SECRET_REDACTED]')
    .replace(/\b(?:gh[pousr]_[a-z0-9_]+|github_pat_[a-z0-9_]+|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)\b/giu, '[TOKEN_REDACTED]')
    .replace(/[a-z]:\\[^\r\n"<>]*/giu, '[PATH_REDACTED]')
    .replace(/\/(?:home|Users)\/[^\s"<>]+/gu, '[PATH_REDACTED]')
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/giu, '[EMAIL_REDACTED]')
    .replace(/[a-f0-9:.]+(?:%[a-z0-9_-]+)?/giu, (candidate) => {
      const address = candidate.replace(/[.]+$/u, '');
      return isIP(address) === 6 ? '[IP_REDACTED]' + candidate.slice(address.length) : candidate;
    })
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu, '[IP_REDACTED]');
}

/** Bounded, recursive defensive copy. Never serialize the original input afterwards. */
export function sanitize(value: unknown, secrets: readonly string[] = [], depth = 0): unknown {
  if (depth > 8) return '[DEPTH_LIMIT]';
  if (typeof value === 'string') return sanitizeText(value, secrets);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.slice(0, 256).map((item: unknown) => sanitize(item, secrets, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 256).map(([key, item]) =>
      [sanitizeText(key, secrets), sensitiveKey.test(key) ? '[REDACTED]' : sanitize(item, secrets, depth + 1)]));
  }
  return '[UNSUPPORTED]';
}

export function escapeMarkdown(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;').replaceAll('`', '&#96;').replaceAll('[', '&#91;').replaceAll(']', '&#93;')
    .replaceAll('\\', '&#92;').replace(/[\r\n]/gu, ' ');
}
