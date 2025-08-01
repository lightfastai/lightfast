# Clerk Satellite Domain Implementation Guide

This guide shows the exact changes needed to implement Clerk satellite domains for auth.lightfast.ai and app.lightfast.ai using the new `@repo/url-utils` package.

## Prerequisites

1. **Clerk Dashboard Setup**:
   - Set primary domain to `lightfast.ai`
   - Add satellite domains: `auth.lightfast.ai`, `app.lightfast.ai`
   - Get the Clerk frontend API domain for DNS setup

2. **DNS Configuration**:
   ```
   # Add these CNAME records to your DNS provider
   clerk.lightfast.ai      → [clerk-frontend-api-domain]
   clerk.auth.lightfast.ai → [clerk-frontend-api-domain]
   clerk.app.lightfast.ai  → [clerk-frontend-api-domain]
   ```

3. **Vercel Project IDs** (already configured):
   - www: `prj_JRXRxBruTvB5Bs99JjA63TLek6GT`
   - auth: `prj_PBHuC98wYesWVlTqMMwLg1Cm7pui`
   - app: `prj_n3D3MPJlt9DX9OSAVpJYXFb1pGBc`

## Implementation Changes

### 1. Update Auth App (`apps/auth`)

#### Add dependency to package.json:
```json
{
  "dependencies": {
    "@repo/url-utils": "workspace:*"
  }
}
```

#### Update `apps/auth/src/app/layout.tsx`:
```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { getClerkConfig } from "@repo/url-utils";

const clerkConfig = getClerkConfig("auth");

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      {...clerkConfig}
      appearance={{
        variables: {
          colorPrimary: "#3b82f6",
          colorBackground: "#0a0a0a",
          colorInputBackground: "#18181b",
          colorInputText: "#fafafa",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        {/* ... rest of layout */}
      </html>
    </ClerkProvider>
  );
}
```

#### Update `apps/auth/src/middleware.ts`:
```typescript
import { clerkMiddleware } from "@clerk/nextjs/server";
import { getClerkMiddlewareConfig } from "@repo/url-utils";

const config = getClerkMiddlewareConfig("auth");

export default clerkMiddleware(config);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### 2. Update Main App (`apps/app`)

#### Add dependency to package.json:
```json
{
  "dependencies": {
    "@repo/url-utils": "workspace:*"
  }
}
```

#### Update `apps/app/src/app/layout.tsx`:
```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { getClerkConfig } from "@repo/url-utils";

const clerkConfig = getClerkConfig("app");

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider {...clerkConfig}>
      <html lang="en" suppressHydrationWarning>
        {/* ... rest of layout */}
      </html>
    </ClerkProvider>
  );
}
```

#### Update `apps/app/src/middleware.ts`:
```typescript
import { clerkMiddleware } from "@clerk/nextjs/server";
import { getClerkMiddlewareConfig } from "@repo/url-utils";

const config = getClerkMiddlewareConfig("app");

export default clerkMiddleware(config);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### 3. Update WWW App (`apps/www`)

#### Add dependency to package.json:
```json
{
  "dependencies": {
    "@repo/url-utils": "workspace:*"
  }
}
```

#### Update navigation links to use auth app:
```tsx
import { getAuthUrls } from "@repo/url-utils";

// In your header/navigation component
const authUrls = getAuthUrls();

<Link href={authUrls.signIn}>Sign In</Link>
<Link href={authUrls.signUp}>Get Started</Link>
```

### 4. Environment Variables

Set these in Vercel Dashboard for ALL projects:

```env
# Same for all projects
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

# Project-specific (optional, already set in package)
# Only needed if you want to override the defaults
VERCEL_PROJECT_ID_WWW=prj_JRXRxBruTvB5Bs99JjA63TLek6GT
VERCEL_PROJECT_ID_AUTH=prj_PBHuC98wYesWVlTqMMwLg1Cm7pui
VERCEL_PROJECT_ID_APP=prj_n3D3MPJlt9DX9OSAVpJYXFb1pGBc
```

### 5. Cross-App Navigation

Use the navigation utilities for cross-app links:

```tsx
import { navigateToApp, createCrossAppUrl } from "@repo/url-utils";

// Client-side navigation
<button onClick={() => navigateToApp("app", "/dashboard")}>
  Go to Dashboard
</button>

// Server-side redirect
import { redirect } from "next/navigation";
import { createCrossAppUrl } from "@repo/url-utils";

redirect(createCrossAppUrl("app", "/dashboard"));
```

### 6. Handle Post-Auth Redirects

In your auth app's sign-in success handler:

```tsx
import { getRedirectUrl } from "@repo/url-utils";

// After successful sign-in
const redirectUrl = getRedirectUrl("app"); // defaults to app
window.location.href = redirectUrl;
```

## Testing Checklist

- [ ] DNS records propagated (check with `dig clerk.auth.lightfast.ai`)
- [ ] Install dependencies: `pnpm install`
- [ ] Update all app layouts with new ClerkProvider config
- [ ] Update all app middlewares with new config
- [ ] Test sign-in flow: www → auth → app
- [ ] Test sign-out flow: app → www
- [ ] Test direct access to protected routes
- [ ] Test preview deployments (URLs should auto-adjust)

## Troubleshooting

### "Satellite domain not verified"
- Check DNS propagation: `dig clerk.auth.lightfast.ai`
- Ensure CNAME points to Clerk's frontend API domain
- Wait up to 48 hours for propagation

### "Session not shared across domains"
- Verify all apps use the same Clerk instance (same keys)
- Check that satellite config is properly set in ClerkProvider
- Ensure cookies are set with correct domain (`.lightfast.ai`)

### "Redirect loops"
- Check middleware config public/private routes
- Verify redirect URLs in getClerkConfig
- Use browser DevTools to trace redirects

### "Preview deployments not working"
- Set Vercel project IDs as environment variables
- Check that branch URLs are being generated correctly
- Verify Related Projects configuration if using that feature

## Next Steps

1. Run `pnpm install` to install new dependencies
2. Make the code changes listed above
3. Deploy to Vercel and test the authentication flow
4. Monitor Clerk Dashboard for any satellite domain issues