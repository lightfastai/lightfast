# Monorepo App Setup Guide

This guide provides a comprehensive step-by-step process for creating new Next.js applications within the Lightfast monorepo. The guide is designed to be interactive - Claude Code will ask you about your specific requirements before proceeding.

## 🎯 Configuration Options

When setting up a new app, Claude Code should ask the user the following questions:

### Required Information
1. **App name**: What is the name of your app? (e.g., `chat`, `dashboard`, `admin`)
2. **App URL**: What will be the production URL? (e.g., `chat.lightfast.ai`)
3. **Port number**: Which port should it use? (suggested: 4104 for chat, or next available)
4. **App description**: Brief description for metadata and SEO

### App Type Configuration
Choose one of the following app types:

#### 1. **Full App** (like `apps/app`)
- ✅ Clerk authentication with protected routes
- ✅ Sentry error tracking
- ✅ BetterStack logging
- ✅ Health check endpoints
- ✅ Full layout with sidebar
- Best for: Main application interfaces

#### 2. **Marketing Site** (like `apps/www`)
- ✅ Partial Clerk auth (specific routes only)
- ✅ Sentry + BetterStack
- ✅ Health checks
- ✅ Inngest background jobs
- ✅ Email capabilities
- Best for: Public-facing websites with some auth features

#### 3. **Standalone App** (no auth)
- ❌ No authentication
- ✅ Optional Sentry/BetterStack
- ✅ Health checks
- ✅ Minimal setup
- Best for: Public tools, documentation sites

#### 4. **Multi-Zone App** (with basePath)
- ✅ Configured for Next.js Multi-Zones
- ✅ Custom basePath (e.g., `/playground`)
- ✅ Can be embedded in other apps
- Best for: Micro-frontends, embedded features

### Optional Features
Ask which additional features to include:

- [ ] **Database access** (`@vendor/db`)
- [ ] **Email functionality** (`@vendor/email`)
- [ ] **Background jobs** (`@vendor/inngest`)
- [ ] **Related projects** (Vercel feature)
- [ ] **Analytics** (PostHog, Vercel Analytics)
- [ ] **Rate limiting** (`@vendor/security`)
- [ ] **Storage** (`@vendor/storage`)
- [ ] **TRPC API** (`@vendor/trpc`)

## 📋 Interactive Setup Process

**IMPORTANT FOR CLAUDE CODE**: Before starting, ask the user:

```
I'll help you set up a new app in the monorepo. Please provide:

1. App name: [e.g., chat]
2. Production URL: [e.g., chat.lightfast.ai]
3. Port number: [e.g., 4104]
4. Brief description: [e.g., "Real-time chat application"]

What type of app do you want to create?
a) Full App (with auth, monitoring, sidebar layout)
b) Marketing Site (partial auth, public pages, email)
c) Standalone App (no auth, minimal setup)
d) Multi-Zone App (with basePath for embedding)

Which optional features do you need? (comma-separated or "none"):
- database
- email
- background-jobs
- analytics
- rate-limiting
- storage
- trpc
- related-projects
```

## Step-by-Step Setup Process

### 1. Create App Directory Structure

```bash
# Create the new app directory
mkdir -p apps/[app-name]
cd apps/[app-name]

# Create the source directory structure
mkdir -p src/app/{(app),'(health)/api/health'}
mkdir -p src/{components,lib}
mkdir -p public
```

### 2. Package Configuration

Create `package.json` based on app type:

#### Base Package Configuration (All Apps)

```json
{
  "name": "@lightfast/[app-name]",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm with-env next build",
    "clean": "git clean -xdf .cache .next .turbo .vercel node_modules",
    "dev": "pnpm with-env next dev --turbo --port [PORT]",
    "lint": "eslint",
    "start": "pnpm with-env next start -p [PORT]",
    "typecheck": "tsc --noEmit",
    "with-env": "dotenv -e ./.vercel/.env.development.local --"
  },
  "dependencies": {
    "@repo/lightfast-config": "workspace:*",
    "@repo/ui": "workspace:*",
    "@t3-oss/env-nextjs": "^0.12.0",
    "@vendor/next": "workspace:*",
    "@vendor/observability": "workspace:*",
    "next": "catalog:",
    "react": "catalog:react19",
    "react-dom": "catalog:react19",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@tailwindcss/postcss": "catalog:tailwind4",
    "@types/node": "catalog:",
    "@types/react": "catalog:react19",
    "@types/react-dom": "catalog:react19",
    "dotenv-cli": "^8.0.0",
    "eslint": "catalog:",
    "postcss": "catalog:tailwind4",
    "tailwindcss": "catalog:tailwind4",
    "typescript": "catalog:"
  }
}
```

#### Additional Dependencies by App Type

**For Full App or Marketing Site (with auth):**
```json
{
  "dependencies": {
    "@clerk/nextjs": "catalog:",
    "@vendor/clerk": "workspace:*",
    "@repo/url-utils": "workspace:*",
    "@repo/lightfast-react": "workspace:*",
    "@vercel/toolbar": "^0.1.28"
  }
}
```

**For Standalone App (add `.clerk` to clean script):**
```json
{
  "scripts": {
    "clean": "git clean -xdf .cache .next .turbo .vercel node_modules"
  }
}
```

**Optional Feature Dependencies:**
```json
{
  "dependencies": {
    // If database selected:
    "@vendor/db": "workspace:*",
    
    // If email selected:
    "@vendor/email": "workspace:*",
    
    // If background-jobs selected:
    "@vendor/inngest": "workspace:*",
    
    // If analytics selected:
    "@vendor/analytics": "workspace:*",
    
    // If rate-limiting selected:
    "@vendor/security": "workspace:*",
    
    // If storage selected:
    "@vendor/storage": "workspace:*",
    
    // If trpc selected:
    "@vendor/trpc": "workspace:*"
  }
}
```

**Port Assignment Convention:**
- www: 4101
- darkarmy: 4102
- app: 4103
- chat: 4104
- New apps: Continue incrementing from 4105

### 3. TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"],
    "jsx": "preserve",
    "baseUrl": ".",
    "types": [],
    "paths": {
      "~/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }],
    "module": "esnext"
  },
  "include": [".", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4. Turbo Configuration

Create `turbo.json`:

```json
{
  "$schema": "https://turborepo.org/schema.json",
  "extends": ["//"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": [
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "CLERK_SECRET_KEY",
        "NEXT_PUBLIC_VERCEL_ENV"
      ],
      "outputs": [".next/**", "!.next/cache/**", "next-env.d.ts"]
    },
    "dev": {
      "persistent": true
    }
  }
}
```

### 5. Next.js Configuration

Create `next.config.ts` based on app type:

#### For Full App / Marketing Site / Standalone (Standard Config)

```typescript
import { NextConfig } from "next";

import "./src/env";

import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

import { env } from "./src/env";

let config: NextConfig = withBetterStack(
  mergeNextConfig(vendorConfig, {
    reactStrictMode: true,
    transpilePackages: [
      "@repo/ui",
      "@repo/lightfast-config",
      // Add these only if using auth:
      "@repo/lightfast-react",
      "@repo/url-utils",
      "@vendor/clerk",
      // Always include:
      "@vendor/observability",
      "@vendor/next",
      // Add optional vendors as needed
    ],
    experimental: {
      optimizeCss: true,
      optimizePackageImports: ["@repo/ui", "lucide-react"],
    },
    // Add app-specific rewrites if needed
    async rewrites() {
      return [];
    },
  })
);

// Apply Sentry configuration in Vercel environment
if (env.VERCEL) {
  config = withSentry(config);
}

export default config;
```

#### For Multi-Zone App (with basePath)

```typescript
import { NextConfig } from "next";

import "./src/env";

import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";

import { env } from "./src/env";

let config: NextConfig = withBetterStack(
  mergeNextConfig(vendorConfig, {
    basePath: "/[base-path]", // e.g., "/playground"
    assetPrefix: process.env.NODE_ENV === "production" ? "/[base-path]" : undefined,
    reactStrictMode: true,
    transpilePackages: [
      "@repo/ui",
      "@repo/lightfast-config",
      "@vendor/observability",
      "@vendor/next",
    ],
    experimental: {
      optimizeCss: true,
      optimizePackageImports: ["@repo/ui", "lucide-react"],
    },
  })
);

// Apply Sentry configuration in Vercel environment
if (env.VERCEL) {
  config = withSentry(config);
}

export default config;
```

#### With Related Projects (add to any config)

```typescript
// In your next.config.ts, add to the merged config:
import { playgroundUrl } from "./src/lib/related-projects";

// Inside mergeNextConfig:
async rewrites() {
  return [
    {
      source: '/[related-path]',
      destination: `${playgroundUrl}/[related-path]`,
    },
    {
      source: '/[related-path]/:path*',
      destination: `${playgroundUrl}/[related-path]/:path*`,
    },
  ];
},
```

### 6. Environment Variables

Create `src/env.ts` based on app type:

#### For Full App / Marketing Site (with Auth)

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { clerkEnvBase } from "@vendor/clerk/env";
import { sentryEnv } from "@vendor/observability/sentry-env";

export const env = createEnv({
  extends: [
    vercel(),
    clerkEnvBase,
    sentryEnv,
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
    // Add based on optional features:
    // If email: RESEND_API_KEY: z.string().min(1),
    // If inngest: INNGEST_EVENT_KEY: z.string().optional(),
    // If database: DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
    // If analytics: NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
```

#### For Standalone App (No Auth)

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets-zod";
import { z } from "zod";

import { sentryEnv } from "@vendor/observability/sentry-env";

export const env = createEnv({
  extends: [
    vercel(),
    sentryEnv, // Optional - can be removed if not using Sentry
  ],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
  },
  client: {
    NEXT_PUBLIC_VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
```

### 7. Middleware Setup

#### For Full App (Protected by Default)

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getClerkMiddlewareConfig, handleCorsPreflightRequest, applyCorsHeaders } from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkConfig = getClerkMiddlewareConfig("[app-name]");

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/api/health",
  // Add other public routes here
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Handle CORS preflight requests
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    return preflightResponse;
  }
  
  // If it's not a public route, protect it
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  
  const response = NextResponse.next();
  
  // Apply CORS headers to the response
  return applyCorsHeaders(response, req);
}, clerkConfig);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

#### For Marketing Site (Selective Protection)

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getClerkMiddlewareConfig, handleCorsPreflightRequest, applyCorsHeaders } from "@repo/url-utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkConfig = getClerkMiddlewareConfig("[app-name]");

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/account(.*)",
  "/api/protected(.*)",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Handle CORS preflight requests
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    return preflightResponse;
  }
  
  // Only protect specific routes
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  
  const response = NextResponse.next();
  
  // Apply CORS headers to the response
  return applyCorsHeaders(response, req);
}, clerkConfig);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

#### For Standalone App (No Auth)

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Simple middleware for CORS or other needs
  const response = NextResponse.next();
  
  // Add any custom headers if needed
  response.headers.set("X-Frame-Options", "DENY");
  
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### 8. Root Layout

#### For Apps with Authentication

```typescript
import type { Metadata, Viewport } from "next";

import "@repo/ui/globals.css";

import { siteConfig } from "@repo/lightfast-config";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { getClerkConfig } from "@repo/url-utils";

export const metadata: Metadata = {
  title: {
    default: "[App Name]",
    template: `%s - [App Name]`,
  },
  metadataBase: new URL("[app-url]"),
  description: "[App Description]",
  keywords: ["Lightfast", "[App Name]"],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "[app-url]",
    title: "[App Name]",
    description: "[App Description]",
    siteName: siteConfig.name,
    images: [{
      url: siteConfig.ogImage,
      width: 1200,
      height: 630,
      alt: siteConfig.name,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "[App Name]",
    description: "[App Description]",
    images: [siteConfig.ogImage],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkConfig = getClerkConfig("[app-name]");

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
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
        <head />
        <body className={cn("bg-background dark min-h-screen", fonts)}>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

#### For Standalone Apps (No Auth)

```typescript
import type { Metadata, Viewport } from "next";

import "@repo/ui/globals.css";

import { siteConfig } from "@repo/lightfast-config";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";

export const metadata: Metadata = {
  title: {
    default: "[App Name]",
    template: `%s - [App Name]`,
  },
  metadataBase: new URL("[app-url]"),
  description: "[App Description]",
  keywords: ["Lightfast", "[App Name]"],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  // ... rest of metadata
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn("bg-background dark min-h-screen", fonts)}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

### 9. Health Check Endpoint

Create `src/app/(health)/api/health/route.ts`:

```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";

export const runtime = "edge";

/**
 * Health check endpoint for monitoring services.
 * Requires Bearer token authentication if HEALTH_CHECK_AUTH_TOKEN is set.
 */
export function GET(request: NextRequest) {
  // Check if authentication is configured
  const authToken = env.HEALTH_CHECK_AUTH_TOKEN;
  
  if (authToken) {
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }
    
    const bearerRegex = /^Bearer\s+(.+)$/i;
    const bearerMatch = bearerRegex.exec(authHeader);
    if (!bearerMatch || bearerMatch[1] !== authToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }
  
  const response = NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "[app-name]",
    environment: env.NODE_ENV,
  });
  
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  
  return response;
}
```

### 10. Instrumentation (Optional - Sentry)

Only include if Sentry monitoring is selected. Create `src/instrumentation.ts`:

```typescript
import { captureRequestError, init } from "@sentry/nextjs";

import { env } from "~/env";

const register = () => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-restricted-properties
  if (process.env.NEXT_RUNTIME === "nodejs") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      tracesSampleRate: 1,
      debug: false,
    });
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars, no-restricted-properties
  if (process.env.NEXT_RUNTIME === "edge") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      tracesSampleRate: 1,
      debug: false,
    });
  }
};

register();

export const onRequestError = captureRequestError;
```

### 11. ESLint Configuration

Create `eslint.config.js`:

```javascript
import baseConfig from "@repo/eslint-config/base";

export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
];
```

### 12. PostCSS Configuration

Create `postcss.config.mjs`:

```javascript
export { default } from "@repo/ui/postcss.config";
```

### 13. Static Assets

Add the following files to `public/`:
- favicon.ico
- favicon-16x16.png
- favicon-32x32.png
- apple-touch-icon.png
- android-chrome-192x192.png
- android-chrome-512x512.png
- og.jpg (OpenGraph image)

### 14. Application-Specific Layout

Create `src/app/(app)/layout.tsx` for authenticated pages:

```typescript
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { Suspense } from "react";
// Import your app-specific components

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <div className="flex h-screen w-full bg-background">
          {/* Add your sidebar component here */}
          <div className="flex border-l border-muted/30 flex-col w-full">
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
```

### 15. Main Page

Create `src/app/(app)/page.tsx`:

```typescript
export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">Welcome to [App Name]</h1>
    </div>
  );
}
```

### 16. Error Pages

Create `src/app/not-found.tsx`:

```typescript
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="text-2xl font-bold">404 - Page Not Found</h2>
      <p className="mt-2 text-muted-foreground">
        The page you're looking for doesn't exist.
      </p>
    </div>
  );
}
```

Create `src/app/global-error.tsx`:

```typescript
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

### 17. Manifest and Robots

Create `src/app/manifest.ts`:

```typescript
import type { MetadataRoute } from "next";

import { siteConfig } from "@repo/lightfast-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "[App Name]",
    short_name: "[App Name]",
    description: "[App Description]",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
```

Create `src/app/robots.ts`:

```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: "[app-url]/sitemap.xml",
  };
}
```

### 18. Optional Configurations

#### Vercel Related Projects

If using Vercel's related projects feature, create `vercel.json`:

```json
{
  "relatedProjects": ["[project-id]"]
}
```

Also create `src/lib/related-projects.ts`:

```typescript
import { makeRelatedProjects } from "@vercel/related-projects";

export const { playgroundUrl } = makeRelatedProjects({
  remotePattern: "https://[related-app].lightfast.ai",
  // For local development, you can override with an environment variable
  localPattern: process.env.RELATED_PROJECT_URL || "http://localhost:[related-port]",
});
```

### 19. Environment Variables Setup

Create `.vercel/.env.development.local` based on selected features:

#### Base Environment Variables (All Apps)

```bash
# Vercel Environment
NEXT_PUBLIC_VERCEL_ENV=development

# Health Check (optional)
HEALTH_CHECK_AUTH_TOKEN=[generate-32-char-token]
```

#### For Apps with Authentication

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

#### For Apps with Monitoring

```bash
# Sentry Error Tracking
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
SENTRY_ORG=lightfast
SENTRY_PROJECT=[app-name]
SENTRY_AUTH_TOKEN=...

# BetterStack Logging
BETTERSTACK_SOURCE_TOKEN=...
```

#### Optional Feature Environment Variables

```bash
# If email selected:
RESEND_API_KEY=re_...

# If database selected:
DATABASE_URL=postgresql://...

# If inngest selected:
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# If analytics selected:
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# If storage selected:
UPLOADTHING_SECRET=sk_...
UPLOADTHING_APP_ID=...
```

### 20. Update Root Configuration

Add the new app to the root `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  # ... rest of the workspace config
```

Update root `package.json` scripts:

```json
{
  "scripts": {
    // ... existing scripts
    "dev:[app-name]": "turbo run dev --filter=@lightfast/[app-name]",
    "build:[app-name]": "turbo run build --filter=@lightfast/[app-name]"
  }
}
```

## Testing the Setup

1. Install dependencies:
```bash
pnpm install
```

2. Run the development server:
```bash
pnpm dev:[app-name]
```

3. Test the health check endpoint:
```bash
curl http://localhost:[PORT]/api/health
```

4. Build the application:
```bash
pnpm build:[app-name]
```

## 📦 Optional Feature Implementations

### Adding Inngest Background Jobs

Create `src/app/(inngest)/api/inngest/route.ts`:

```typescript
import { serve } from "@vendor/inngest/server";
import { inngest } from "~/inngest/client";
import * as functions from "~/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: Object.values(functions),
});
```

Create `src/inngest/client.ts`:

```typescript
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "[app-name]",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

Create `src/inngest/functions/index.ts`:

```typescript
import { inngest } from "../client";

export const exampleFunction = inngest.createFunction(
  { id: "example-function" },
  { event: "app/example.event" },
  async ({ event, step }) => {
    // Your function logic here
    return { success: true };
  }
);
```

### Adding Database Access

Use in server components/API routes:

```typescript
import { db } from "@vendor/db";

// Example usage
const users = await db.select().from(schema.users);
```

### Adding Email Functionality

Create `src/lib/email.ts`:

```typescript
import { Resend } from "@vendor/email";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(to: string, name: string) {
  return await resend.emails.send({
    from: "Lightfast <noreply@lightfast.ai>",
    to,
    subject: "Welcome to Lightfast",
    html: `<p>Welcome ${name}!</p>`,
  });
}
```

### Adding Analytics

In client components:

```typescript
"use client";

import { usePostHog } from "@vendor/analytics/providers/posthog/client";

export function MyComponent() {
  const posthog = usePostHog();
  
  const handleClick = () => {
    posthog?.capture("button_clicked", {
      button_name: "cta",
    });
  };
  
  return <button onClick={handleClick}>Click me</button>;
}
```

### Adding Rate Limiting

In API routes:

```typescript
import { arcjet } from "@vendor/security";

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    tokenBucket({
      mode: "LIVE",
      refillRate: 10,
      interval: 60,
      capacity: 100,
    }),
  ],
});

export async function POST(request: NextRequest) {
  const decision = await aj.protect(request);
  
  if (decision.isDenied()) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }
  
  // Continue with request handling
}
```

## 🚀 Deployment Checklist

Based on selected features, ensure these are configured:

### Required for All Apps
- [ ] Environment variables configured in Vercel
- [ ] Health check authentication token set (if using)
- [ ] Custom domain configured
- [ ] Build and deploy successful

### If Using Authentication
- [ ] Clerk application created and keys configured
- [ ] Redirect URLs configured in Clerk dashboard
- [ ] Webhook endpoints configured (if needed)

### If Using Monitoring
- [ ] Sentry project created and DSN configured
- [ ] BetterStack source created and token configured
- [ ] Error alerts configured

### If Using Optional Features
- [ ] Database migrations run (if database)
- [ ] Email domain verified (if email)
- [ ] Inngest cloud configured (if background jobs)
- [ ] Analytics dashboard configured (if analytics)
- [ ] Rate limiting rules reviewed (if rate limiting)

## 🔧 Troubleshooting

### Common Issues

1. **Build failures**: Check that all environment variables are properly set
2. **Authentication issues**: Verify Clerk keys and middleware configuration
3. **Type errors**: Ensure all workspace packages are built (especially vercel-config and url-utils after adding new apps)
4. **Port conflicts**: Use the assigned port convention (check auth is on 4104, not chat)
5. **Missing dependencies**: Run `pnpm install` at the root level
6. **Health check blocked by Clerk**: Even with placeholder keys, Clerk middleware may block health checks. Use valid test keys from Clerk dashboard for proper testing
7. **ProjectName type errors**: When adding a new app, update `VERCEL_PROJECT_IDS` in `packages/vercel-config/src/project-config.ts` and URLs in `url-config.ts`

### Debug Commands

```bash
# Check environment variables
pnpm with-env env | grep CLERK

# Clear all caches
pnpm clean

# Rebuild workspace packages
pnpm build:packages

# Type check
pnpm typecheck

# Check dev server logs
cat /tmp/[app-name]-dev.log
```

## 📝 Implementation Checklist for Claude Code

When setting up a new app, follow this checklist:

1. **Gather Requirements**
   - [ ] Ask user for app configuration preferences
   - [ ] Confirm app name, URL, port, and description
   - [ ] Determine app type and optional features

2. **Update Shared Configurations**
   - [ ] Add app to `VERCEL_PROJECT_IDS` in `packages/vercel-config/src/project-config.ts`
   - [ ] Add URLs to `PRODUCTION_URLS` and `DEVELOPMENT_URLS` in `packages/vercel-config/src/url-config.ts`
   - [ ] Update `getAllAppUrls()` function to include new app
   - [ ] Build vercel-config package: `cd packages/vercel-config && pnpm build`
   - [ ] Build url-utils package: `cd packages/url-utils && pnpm build`

3. **Create Base Structure**
   - [ ] Create app directory and folder structure
   - [ ] Set up package.json with appropriate dependencies
   - [ ] Configure TypeScript and ESLint
   - [ ] Set up PostCSS and Tailwind

4. **Configure Next.js**
   - [ ] Create next.config.ts based on app type
   - [ ] Set up environment variables in src/env.ts
   - [ ] Configure middleware based on auth requirements
   - [ ] Create root and app layouts

5. **Implement Core Features**
   - [ ] Set up health check endpoint
   - [ ] Configure instrumentation (if monitoring)
   - [ ] Add static assets (copy from existing app)
   - [ ] Create initial pages
   - [ ] Add error handling pages (not-found, global-error)
   - [ ] Add metadata files (manifest, robots)

6. **Add Optional Features**
   - [ ] Implement selected optional features
   - [ ] Configure environment variables
   - [ ] Test integrations

7. **Final Steps**
   - [ ] Update root package.json scripts (add build:[app-name] and dev:[app-name])
   - [ ] Create .vercel/.env.development.local with required env vars
   - [ ] Run `pnpm install` at root
   - [ ] Test development server
   - [ ] Run linting and type checking
   - [ ] Test health check endpoint
   - [ ] Document any app-specific setup

## 🎯 Quick Reference

### Port Assignment
- 4101: www
- 4102: darkarmy  
- 4103: app
- 4104: auth (was mistakenly noted as chat earlier)
- 4105: playground  
- 4106: chat (new)
- 4107+: New apps

### App Types Summary
1. **Full App**: Complete auth, monitoring, sidebar layout
2. **Marketing Site**: Partial auth, public pages, email/jobs
3. **Standalone**: No auth, minimal setup, public tool
4. **Multi-Zone**: Embedded app with basePath

### Vendor Package Reference
- `@vendor/clerk`: Authentication
- `@vendor/db`: Database access
- `@vendor/email`: Email sending
- `@vendor/inngest`: Background jobs
- `@vendor/analytics`: Analytics tracking
- `@vendor/security`: Rate limiting
- `@vendor/storage`: File storage
- `@vendor/trpc`: Type-safe APIs
- `@vendor/observability`: Logging and monitoring
- `@vendor/next`: Next.js configuration helpers