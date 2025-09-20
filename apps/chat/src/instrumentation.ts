import {
  captureRequestError,
  init as initSentry,
  vercelAIIntegration,
} from "@sentry/nextjs";
import { consoleLoggingIntegration } from "@sentry/core";

import { env } from "~/env";

type InitOptions = Parameters<typeof initSentry>[0];
type Integration = ReturnType<typeof vercelAIIntegration>;
interface ProfilingModule {
	nodeProfilingIntegration: () => Integration;
}

const loadNodeProfilingIntegration = (): Integration => {
  type RequireFn = (moduleId: string) => unknown;
  const nodeRequire = eval("require") as RequireFn;
  const { nodeProfilingIntegration } = nodeRequire(
    "@sentry/profiling-node",
  ) as ProfilingModule;

  return nodeProfilingIntegration();
};

const createInitOptions = (runtime: "nodejs" | "edge") => {
  const asIntegration = <T extends Integration>(integration: T) => integration;

  const integrations: Integration[] = [
    asIntegration(vercelAIIntegration()),
    asIntegration(consoleLoggingIntegration({ levels: ["log", "warn", "error"] })),
  ];

  if (runtime === "nodejs") {
    integrations.push(loadNodeProfilingIntegration());
  }

  const baseOptions: InitOptions = {
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    tracesSampleRate: 1,
    debug: false,
    enableLogs: true,
    integrations,
  };

	if (runtime === "nodejs") {
		return {
			...baseOptions,
			profilesSampleRate: 1,
			profileSessionSampleRate: 1,
			profileLifecycle: "trace",
		};
	}

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
