import type { NextRequest } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { deusAppRouter, createTRPCContext } from "@api/console";
import { env } from "~/env";

// Use Node.js runtime instead of Edge for GitHub App crypto operations
// Octokit requires Node.js crypto APIs for RSA key signing (not available in Edge)
export const runtime = "nodejs";

const isProductionDeploy = env.VERCEL_ENV === "production";

/**
 * Configure CORS headers:
 * - Production: restrict to known origins
 * - Other environments: allow all origins for easier local/preview development
 */
const productionOrigins = new Set(["https://deus.lightfast.ai"]);

const setCorsHeaders = (req: NextRequest, res: Response) => {
	const originHeader = req.headers.get("origin");
	const requestOrigin = req.nextUrl.origin;

	const allowOrigin = !isProductionDeploy
		? "*"
		: originHeader &&
				(productionOrigins.has(originHeader) || originHeader === requestOrigin)
			? originHeader
			: null;

	if (!allowOrigin) {
		return res;
	}

	res.headers.set("Access-Control-Allow-Origin", allowOrigin);
	res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
	res.headers.set(
		"Access-Control-Allow-Headers",
		"content-type,authorization,x-trpc-source",
	);

	if (allowOrigin !== "*") {
		res.headers.set("Vary", "Origin");
		res.headers.set("Access-Control-Allow-Credentials", "true");
	}

	return res;
};

export const OPTIONS = (req: NextRequest) => {
	const response = new Response(null, {
		status: 204,
	});
	return setCorsHeaders(req, response);
};

const handler = async (req: NextRequest) => {
	const response = await fetchRequestHandler({
		endpoint: "/api/trpc",
		router: deusAppRouter,
		req,
		createContext: () =>
			createTRPCContext({
				headers: req.headers,
			}),
		onError({ error, path }) {
			console.error(`>>> tRPC Error on '${path}'`, error);
		},
	});

	return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
