import {
  captureConsoleIntegration,
  captureRequestError,
  extraErrorDataIntegration,
  init as initSentry,
  spotlightIntegration,
  vercelAIIntegration,
} from "@sentry/nextjs";
import { consoleLoggingIntegration } from "@sentry/core";

import { env } from "~/env";

type InitOptions = Parameters<typeof initSentry>[0];
type Integration = ReturnType<typeof vercelAIIntegration>;

const createInitOptions = (runtime: "nodejs" | "edge"): InitOptions => {
  const asIntegration = <T extends Integration>(integration: T) => integration;

  const integrations: Integration[] = [
    asIntegration(vercelAIIntegration()),
    asIntegration(consoleLoggingIntegration({ levels: ["log", "warn", "error"] })),
    asIntegration(captureConsoleIntegration({ levels: ["error", "warn"] })),
    asIntegration(extraErrorDataIntegration({ depth: 3 })),
    ...(runtime === "nodejs" && env.NEXT_PUBLIC_VERCEL_ENV === "development"
      ? [asIntegration(spotlightIntegration())]
      : []),
  ];

  // Note: Node.js profiling integration removed due to Next.js 15.5 + Turbopack build issues
  // with dynamic require() statements in @sentry-internal/node-cpu-profiler

  const baseOptions: InitOptions = {
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    environment: env.NEXT_PUBLIC_VERCEL_ENV,
    tracesSampleRate: 1,
    debug: false,
    enableLogs: true,
    integrations,
  };

	return baseOptions;
};

const register = () => {
	// eslint-disable-next-line turbo/no-undeclared-env-vars
	if (process.env.NEXT_RUNTIME === "nodejs") {
		initSentry(createInitOptions("nodejs"));
	}

	// eslint-disable-next-line turbo/no-undeclared-env-vars
	if (process.env.NEXT_RUNTIME === "edge") {
		initSentry(createInitOptions("edge"));
	}
};

register();

export const onRequestError = captureRequestError;
