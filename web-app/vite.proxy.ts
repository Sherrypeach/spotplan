import type { ProxyOptions } from 'vite';

// Addresses of this machine. Only a proxy running here (the dev tunnel) is
// trusted to report the browser's address in X-Forwarded-For.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * The X-Forwarded-For value to send to the API. The API limits sign-in tries
 * per browser address, so a browser connecting directly must not be able to
 * pick its own address; behind the local tunnel, the tunnel's value is kept.
 */
export function forwardedFor(incoming: string | undefined, remoteAddress: string | undefined): string {
  const peer = remoteAddress ?? '';
  if (incoming && LOOPBACK.has(peer)) return `${incoming}, ${peer}`;
  return peer;
}

/** The app reaches the API at its own /api path, so the session cookie is same-origin. */
export function apiProxy(target: string): Record<string, ProxyOptions> {
  return {
    '/api/': {
      target,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyRequest, request) => {
          const incoming = request.headers['x-forwarded-for'];
          const header = Array.isArray(incoming) ? incoming.join(', ') : incoming;
          proxyRequest.setHeader('x-forwarded-for', forwardedFor(header, request.socket.remoteAddress));
        });
      },
    },
  };
}
