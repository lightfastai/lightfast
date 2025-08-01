# Vercel + Clerk Setup for Lightfast Subdomains

This guide explains the correct way to set up auth.lightfast.ai and app.lightfast.ai using Vercel's Related Projects feature and Shared Environment Variables with Clerk authentication.

## Architecture Overview

We'll use Vercel's Related Projects feature to sync deployments and Shared Environment Variables at the team level:

- **lightfast.ai** (www app) - Marketing/landing page
- **auth.lightfast.ai** (auth app) - Authentication flows
- **app.lightfast.ai** (app) - Main application

All three are separate Vercel projects sharing:
- The same Clerk instance via Shared Environment Variables
- Deployment URLs via Related Projects feature

## Setup Steps

### 1. Vercel Project Structure

Create three separate Vercel projects:

1. **lightfast-www** → lightfast.ai
2. **lightfast-auth** → auth.lightfast.ai  
3. **lightfast-app** → app.lightfast.ai

### 2. DNS Configuration

Add these DNS records to your domain provider:

```
# Root domain
A     @              76.76.21.21
A     @              76.223.126.88

# Subdomains
CNAME auth           cname.vercel-dns.com
CNAME app            cname.vercel-dns.com
CNAME www            cname.vercel-dns.com

# Clerk authentication (required for production)
CNAME clerk          [clerk-frontend-api-domain]
```

### 3. Vercel Domain Configuration

In each Vercel project settings:

#### lightfast-www project:
- Add domain: `lightfast.ai`
- Add domain: `www.lightfast.ai`

#### lightfast-auth project:
- Add domain: `auth.lightfast.ai`

#### lightfast-app project:
- Add domain: `app.lightfast.ai`

### 4. Clerk Configuration

In Clerk Dashboard:

1. Go to **Domains**
2. Set primary domain: `lightfast.ai`
3. This automatically enables authentication across all subdomains

### 5. Update Application Code

#### Auth App (apps/auth/src/app/layout.tsx)

```tsx
<ClerkProvider
  signInUrl="/sign-in"
  signInFallbackRedirectUrl="https://app.lightfast.ai"
  appearance={{
    // your appearance config
  }}
>
```

#### Auth App Middleware (apps/auth/src/middleware.ts)

```typescript
export default clerkMiddleware({
  publicRoutes: ["/"],
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
  // Redirect to app after sign in
  afterSignInUrl: "https://app.lightfast.ai",
  afterSignUpUrl: "https://app.lightfast.ai",
});
```

#### Main App (apps/app/src/app/layout.tsx)

```tsx
<ClerkProvider
  signInUrl="https://auth.lightfast.ai/sign-in"
  signUpUrl="https://auth.lightfast.ai/sign-up"
  signInFallbackRedirectUrl="/"
>
```

#### Main App Middleware (apps/app/src/middleware.ts)

```typescript
export default clerkMiddleware({
  publicRoutes: ["/api/health"],
  signInUrl: "https://auth.lightfast.ai/sign-in",
  signUpUrl: "https://auth.lightfast.ai/sign-up",
});
```

### 6. Shared Environment Variables (Team Level)

Configure shared environment variables at the team level in Vercel:

1. Go to **Team Settings** → **Environment Variables**
2. Create these shared variables:

```env
# Clerk Authentication (shared across all projects)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

# For development/preview environments
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV=pk_test_xxx
CLERK_SECRET_KEY_DEV=sk_test_xxx
```

3. Link these variables to all three projects (www, auth, app)

### 7. Related Projects Configuration

Use Vercel's Related Projects feature to sync deployment URLs:

**Finding Project IDs**: You can find each project's ID in the Vercel Dashboard under Project Settings → General → Project ID

#### In apps/auth/lib/config.ts:
```typescript
import { withRelatedProject } from '@vercel/related-projects';

export const getAppUrl = () => {
  return withRelatedProject({
    projectName: "lightfast-app",
    defaultHost: process.env.NEXT_PUBLIC_APP_URL || "https://app.lightfast.ai",
  });
};

export const getWwwUrl = () => {
  return withRelatedProject({
    projectName: "lightfast-www",
    defaultHost: process.env.NEXT_PUBLIC_WWW_URL || "https://lightfast.ai",
  });
};
```

#### In apps/app/lib/config.ts:
```typescript
import { withRelatedProject } from '@vercel/related-projects';

export const getAuthUrl = () => {
  return withRelatedProject({
    projectName: "lightfast-auth",
    defaultHost: process.env.NEXT_PUBLIC_AUTH_URL || "https://auth.lightfast.ai",
  });
};
```

### 8. Update Application Code with Dynamic URLs

#### Auth App Middleware (apps/auth/src/middleware.ts)
```typescript
import { getAppUrl } from "~/lib/config";

export default clerkMiddleware({
  publicRoutes: ["/"],
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
  // Use dynamic URL from Related Projects
  afterSignInUrl: getAppUrl(),
  afterSignUpUrl: getAppUrl(),
});
```

#### Main App (apps/app/src/app/layout.tsx)
```tsx
import { getAuthUrl } from "~/lib/config";

const authUrl = getAuthUrl();

<ClerkProvider
  signInUrl={`${authUrl}/sign-in`}
  signUpUrl={`${authUrl}/sign-up`}
  signInFallbackRedirectUrl="/"
>
```

### 9. Security Headers (Optional)

Add to each project's `next.config.ts`:

```typescript
async headers() {
  return [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-Frame-Options",
          value: "SAMEORIGIN",
        },
        {
          key: "Content-Security-Policy",
          value: "frame-ancestors 'self' https://*.lightfast.ai",
        },
      ],
    },
  ];
}
```

## How It Works

1. **Authentication Flow**:
   - User visits `app.lightfast.ai`
   - If not authenticated, redirected to `auth.lightfast.ai/sign-in`
   - After sign-in, redirected back to `app.lightfast.ai`
   - Session cookie is shared across all `*.lightfast.ai` subdomains

2. **Session Sharing**:
   - Clerk automatically handles session sharing across subdomains
   - No satellite configuration needed
   - Cookie domain is set to `.lightfast.ai`

3. **Preview Deployments**:
   - Each project gets its own preview URLs
   - Use Vercel's Preview Deployment Suffix (Pro/Enterprise)
   - Or use branch-specific subdomains

## Benefits of This Approach

1. **Simpler Configuration**: No satellite domain setup required
2. **Better Performance**: Direct authentication without cross-domain hops
3. **Easier Development**: Each app can be developed independently
4. **Vercel Native**: Uses Vercel's built-in features (Related Projects + Shared Env Vars)
5. **Shared Sessions**: Automatic session sharing across subdomains
6. **Dynamic URLs**: Preview deployments automatically use correct URLs
7. **Single Source of Truth**: Team-level environment variables

## Deployment Checklist

- [ ] Three separate Vercel projects created
- [ ] DNS records configured (A records for root, CNAME for subdomains)
- [ ] Domains added to each Vercel project
- [ ] Shared Environment Variables configured at team level
- [ ] Related Projects configuration added to each app
- [ ] ClerkProvider configured with dynamic URLs
- [ ] Middleware updated with dynamic redirect URLs
- [ ] Test authentication flow across all domains
- [ ] Test preview deployments with Related Projects

## Common Issues

1. **Session not shared**: Ensure all projects use the same Clerk instance
2. **Redirect loops**: Check middleware redirect URLs
3. **404 on subdomains**: Verify DNS propagation (can take 48 hours)
4. **Preview deploys**: Use custom preview domains or Vercel's suffix feature

This approach is simpler and more maintainable than satellite domains!