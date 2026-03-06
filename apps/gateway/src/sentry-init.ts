import {
	ServerRuntimeClient,
	createTransport,
	initAndBind,
} from "@vendor/observability/sentry";
import { env } from "./env.js";

initAndBind(ServerRuntimeClient, {
	dsn: env.SENTRY_DSN,
	environment: env.VERCEL_ENV ?? "development",
	tracesSampleRate: 0,
	debug: false,
	integrations: [],
	stackParser: () => [],
	transport: (opts) =>
		createTransport(opts, async (request) => {
			const response = await fetch(opts.url, {
				method: "POST",
				body: request.body as string,
			});
			return { statusCode: response.status };
		}),
});
