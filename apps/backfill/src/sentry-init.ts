import {
	ServerRuntimeClient,
	createTransport,
	initAndBind,
} from "@sentry/core";

initAndBind(ServerRuntimeClient, {
	dsn: process.env.SENTRY_DSN,
	environment: process.env.VERCEL_ENV ?? "development",
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
