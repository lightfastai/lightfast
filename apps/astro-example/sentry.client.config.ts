import {
  captureConsoleIntegration,
  init as initSentry,
  rewriteFramesIntegration,
} from "@sentry/browser";

initSentry({
  dsn: import.meta.env.PUBLIC_SENTRY_DSN,
  environment: import.meta.env.PUBLIC_VERCEL_ENV ?? "development",
  release: import.meta.env.PUBLIC_SENTRY_RELEASE,
  debug: false,
  integrations: [
    rewriteFramesIntegration({
      iteratee: (frame) => {
        if (!frame.filename) {
          return frame;
        }

        try {
          const { origin } = new URL(frame.filename);
          frame.filename = frame.filename.replace(origin, "app://");
        } catch {
          // Leave non-URL frame filenames unchanged.
        }

        return frame;
      },
    }),
    captureConsoleIntegration({ levels: ["error", "warn"] }),
  ],
});
