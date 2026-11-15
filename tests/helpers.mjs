import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const scope = (port = 32123, host = 'localhost') => ({
  enabled: true, profile: 'checkpoint3-loopback', label: 'fixture',
  authorizationReference: 'cp3-local-approval', host, ports: [port], addresses: ['127.0.0.1'],
});
export const env = (port = 32123) => ({
  LAB_NETWORK_ENABLED: 'true', LAB_PROFILE: 'checkpoint3-loopback',
  LAB_TARGET_LABEL: 'fixture', LAB_AUTHORIZATION_REFERENCE: 'cp3-local-approval',
  LAB_TARGET_HOST: 'localhost', LAB_TARGET_ADDRESSES: '127.0.0.1', LAB_AUTHORIZED_PORTS: String(port),
  LAB_CONNECT_TIMEOUT_MS: '100', LAB_DNS_TIMEOUT_MS: '100',
});
export const temporaryRoot = () => mkdtempSync(path.join(root, 'config', 'cp3-test.local.'));
export async function listen(server, t) {
  server.listen({ host: '127.0.0.1', port: 0, exclusive: true });
  await once(server, 'listening');
  t.after(async () => {
    const closed = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections?.();
    await closed;
  });
  const address = server.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1') throw new Error('Unsafe fixture');
  return address.port;
}
