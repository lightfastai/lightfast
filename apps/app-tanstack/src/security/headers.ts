const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://img.clerk.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://clerk.lightfast.ai",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://clerk.lightfast.ai https://clerk-telemetry.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com",
] as const;

const securityHeaders = [
  ["Content-Security-Policy", cspDirectives.join("; ")],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
] as const;

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of securityHeaders) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
