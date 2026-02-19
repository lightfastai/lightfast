import {
  captureRouterTransitionStart,
  init as initSentry,
  replayIntegration,
  reportingObserverIntegration,
  spotlightBrowserIntegration,
} from "@sentry/nextjs";

// Use process.env directly rather than importing ~/env here.
// ~/env pulls in @t3-oss/env-nextjs + zod for schema validation, which adds
// ~150KB to the client bundle just to read two NEXT_PUBLIC_ variables.
// NEXT_PUBLIC_ vars are statically inlined by the Next.js compiler so
// process.env access is safe and equivalent at runtime.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV as
  | "development"
  | "preview"
  | "production"
  | undefined;

initSentry({
  dsn,
  environment: vercelEnv,
  tracesSampleRate: 1.0,
  profilesSampleRate: 0,
  debug: false,
  _experiments: {
    enableLogs: true,
  },
  replaysSessionSampleRate: vercelEnv === "production" ? 0.05 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    reportingObserverIntegration({
      types: ["crash", "deprecation", "intervention"],
    }),
    ...(vercelEnv === "development" ? [spotlightBrowserIntegration()] : []),
  ],
});

export const onRouterTransitionStart = captureRouterTransitionStart;
