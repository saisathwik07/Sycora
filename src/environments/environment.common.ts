/**
 * Resolves the API base URL (includes `/api` prefix).
 * - Local dev + LAN + ng serve: use same-origin `/api` so Angular CLI proxy avoids CORS and wrong remote hosts.
 * - Deployed / public hostname: use configured backend URL.
 */
export function resolveApiUrl(defaultRemoteApi: string): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000/api';
  }

  const hostname = window.location.hostname;

  const isLoopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]';

  const isPrivateLan =
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname);

  if (isLoopback || isPrivateLan) {
    return '/api';
  }

  return defaultRemoteApi;
}
