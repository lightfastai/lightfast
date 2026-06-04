import * as Sentry from "@sentry/tanstackstart-react";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

const TOKEN_RE = /token=[^&]+/;
const CLERK_TICKET_RE = /__clerk_ticket=[^&]+/;
const TICKET_RE = /ticket=[^&]+/;

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: true,
    enableLogs: true,
    tracesSampleRate: 1.0,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.type === "navigation" && breadcrumb.data?.to) {
        breadcrumb.data.to = String(breadcrumb.data.to)
          .replace(TOKEN_RE, "token=REDACTED")
          .replace(CLERK_TICKET_RE, "__clerk_ticket=REDACTED")
          .replace(TICKET_RE, "ticket=REDACTED");
      }
      return breadcrumb;
    },
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  );
});
