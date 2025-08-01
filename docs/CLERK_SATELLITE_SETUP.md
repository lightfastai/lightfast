# Clerk Satellite Domain Setup for Lightfast

This guide explains how to configure Clerk authentication with satellite domains for auth.lightfast.ai and app.lightfast.ai.

## Overview

In our architecture:
- **Primary Domain**: `lightfast.ai` (www app) - Where authentication state is managed
- **Satellite Domains**:
  - `auth.lightfast.ai` - Dedicated authentication portal
  - `app.lightfast.ai` - Main application

## Setup Steps

### 1. Clerk Dashboard Configuration

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com/)
2. Navigate to **Domains** → **Satellites**
3. Add satellite domains:
   - `auth.lightfast.ai`
   - `app.lightfast.ai`

### 2. DNS Configuration

For each satellite domain, add a CNAME record:

```
clerk.auth.lightfast.ai → CNAME → [Clerk-provided-domain]
clerk.app.lightfast.ai → CNAME → [Clerk-provided-domain]
```

**Important**: If using Cloudflare, set the DNS record to "DNS only" mode (gray cloud, not orange) to prevent reverse proxy issues.

### 3. Environment Variables

#### For auth.lightfast.ai (Auth App)

```env
# Clerk Core
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

# Satellite Configuration
CLERK_DOMAIN=auth.lightfast.ai
CLERK_IS_SATELLITE=true

# Primary Domain URLs (for redirects)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=https://lightfast.ai/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=https://lightfast.ai/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=https://app.lightfast.ai
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=https://app.lightfast.ai
```

#### For app.lightfast.ai (Main App)

```env
# Clerk Core
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

# Satellite Configuration
CLERK_DOMAIN=app.lightfast.ai
CLERK_IS_SATELLITE=true

# Auth Domain URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=https://auth.lightfast.ai/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=https://auth.lightfast.ai/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL=https://lightfast.ai
```

#### For lightfast.ai (Primary/Marketing)

```env
# Clerk Core
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

# Primary Domain Configuration
CLERK_DOMAIN=lightfast.ai

# Auth URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=https://auth.lightfast.ai/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=https://auth.lightfast.ai/sign-up
```

### 4. Code Configuration

#### Update ClerkProvider (auth app)

```tsx
// apps/auth/src/app/layout.tsx
<ClerkProvider
  signInUrl="/sign-in"
  signInFallbackRedirectUrl="/"
  isSatellite
  domain="auth.lightfast.ai"
  appearance={{
    // your appearance config
  }}
>
```

#### Update ClerkProvider (app)

```tsx
// apps/app/src/app/layout.tsx
<ClerkProvider
  signInUrl="https://auth.lightfast.ai/sign-in"
  signInFallbackRedirectUrl="/"
  isSatellite
  domain="app.lightfast.ai"
>
```

#### Update Middleware

```typescript
// apps/auth/src/middleware.ts
export default clerkMiddleware({
  // Public routes that don't require auth
  publicRoutes: ["/"],
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
  afterSignInUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
  isSatellite: true,
  domain: "auth.lightfast.ai"
});

// apps/app/src/middleware.ts
export default clerkMiddleware({
  // Public routes
  publicRoutes: ["/api/health"],
  signInUrl: "https://auth.lightfast.ai/sign-in",
  isSatellite: true,
  domain: "app.lightfast.ai"
});
```

### 5. Security Considerations

#### Authorized Parties

For enhanced security, explicitly set authorized parties:

```typescript
// In your API routes or server components
import { auth } from "@clerk/nextjs/server";

const { userId } = await auth({
  authorizedParties: [
    "https://lightfast.ai",
    "https://auth.lightfast.ai", 
    "https://app.lightfast.ai"
  ]
});
```

#### CORS Configuration

Ensure proper CORS headers for cross-domain authentication:

```typescript
// next.config.ts
async headers() {
  return [
    {
      source: "/api/:path*",
      headers: [
        {
          key: "Access-Control-Allow-Origin",
          value: process.env.NODE_ENV === "production" 
            ? "https://auth.lightfast.ai,https://app.lightfast.ai" 
            : "*"
        },
        {
          key: "Access-Control-Allow-Credentials",
          value: "true"
        }
      ]
    }
  ];
}
```

### 6. Development Setup

For local development with satellites:

1. Use ngrok or similar to create public URLs
2. Configure Clerk development instance with these URLs
3. Update local .env files with development satellite configuration

```env
# Local development example
CLERK_DOMAIN=localhost:PORT
CLERK_IS_SATELLITE=true
NEXT_PUBLIC_CLERK_SIGN_IN_URL=http://localhost:4103/sign-in
```

### 7. Deployment Checklist

- [ ] DNS CNAME records configured and verified
- [ ] Environment variables set in Vercel/deployment platform
- [ ] ClerkProvider configured with satellite props
- [ ] Middleware updated with satellite configuration
- [ ] Authorized parties configured for API routes
- [ ] CORS headers configured if needed
- [ ] Test authentication flow across all domains

## Authentication Flow

1. User visits `app.lightfast.ai`
2. If not authenticated, redirected to `auth.lightfast.ai/sign-in`
3. After successful authentication, redirected back to `app.lightfast.ai`
4. Session is shared across all satellite domains

## Limitations

- **Passkeys**: Will not work across satellite domains (browser security limitation)
- **DNS Propagation**: Can take up to 48 hours
- **Reverse Proxy**: Cloudflare/similar services must be in "DNS only" mode

## Troubleshooting

1. **"Domain not verified" error**: Check DNS records are properly configured
2. **Session not shared**: Ensure `isSatellite` and `domain` props are set
3. **Redirect loops**: Verify environment variables match across apps
4. **CORS errors**: Check authorized parties and CORS headers

## References

- [Clerk Satellite Domains Documentation](https://clerk.com/docs/advanced-usage/satellite-domains)
- [Clerk Multi-Domain Example](https://github.com/clerk/clerk-nextjs-multi-domain-example)