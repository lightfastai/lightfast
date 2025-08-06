import { NextResponse } from "next/server";

/**
 * Security headers configuration for Lightfast apps
 */
export const SECURITY_HEADERS = {
  // Content Security Policy - Strict but allows necessary resources
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.clerk.com https://*.lightfast.ai wss://*.lightfast.ai https://api.anthropic.com https://*.vercel.com",
    "frame-src 'self' https://challenges.cloudflare.com https://clerk.com https://*.clerk.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  
  // Prevent clickjacking
  "X-Frame-Options": "DENY",
  
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  
  // Enable XSS protection
  "X-XSS-Protection": "1; mode=block",
  
  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",
  
  // Permissions Policy (formerly Feature Policy)
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "magnetometer=()",
    "gyroscope=()",
    "accelerometer=()",
  ].join(", "),
  
  // Strict Transport Security (already set by Vercel in production)
  // Uncomment for self-hosted deployments
  // "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Get CSP header for specific app requirements
 */
export function getCSPHeader(options?: {
  allowInlineScripts?: boolean;
  allowInlineStyles?: boolean;
  additionalConnectSrc?: string[];
  additionalScriptSrc?: string[];
}): string {
  const policy = [];
  
  // Default source
  policy.push("default-src 'self'");
  
  // Script source
  const scriptSrc = ["'self'"];
  if (options?.allowInlineScripts) {
    scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");
  }
  scriptSrc.push(
    "https://clerk.com",
    "https://*.clerk.com",
    "https://challenges.cloudflare.com"
  );
  if (options?.additionalScriptSrc) {
    scriptSrc.push(...options.additionalScriptSrc);
  }
  policy.push(`script-src ${scriptSrc.join(" ")}`);
  
  // Style source
  const styleSrc = ["'self'"];
  if (options?.allowInlineStyles !== false) {
    styleSrc.push("'unsafe-inline'");
  }
  policy.push(`style-src ${styleSrc.join(" ")}`);
  
  // Image source
  policy.push("img-src 'self' data: blob: https:");
  
  // Font source
  policy.push("font-src 'self' data:");
  
  // Connect source (API calls, WebSockets)
  const connectSrc = [
    "'self'",
    "https://*.clerk.com",
    "https://*.lightfast.ai",
    "wss://*.lightfast.ai",
    "https://api.anthropic.com",
    "https://*.vercel.com",
  ];
  if (options?.additionalConnectSrc) {
    connectSrc.push(...options.additionalConnectSrc);
  }
  policy.push(`connect-src ${connectSrc.join(" ")}`);
  
  // Frame source
  policy.push("frame-src 'self' https://challenges.cloudflare.com https://clerk.com https://*.clerk.com");
  
  // Other directives
  policy.push("frame-ancestors 'none'");
  policy.push("base-uri 'self'");
  policy.push("form-action 'self'");
  policy.push("upgrade-insecure-requests");
  
  return policy.join("; ");
}