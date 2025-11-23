import type { NextRequest } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { userRouter, createUserTRPCContext } from "@api/console";
import { env } from "~/env";

// Use Node.js runtime instead of Edge for GitHub App crypto operations
// Octokit requires Node.js crypto APIs for RSA key signing (not available in Edge)
export const runtime = "nodejs";

/**
 * Configure CORS headers with strict origin control
 *
 * Security: Never use wildcard origins to prevent CSRF attacks
 * - Production: Only allow lightfast.ai (all microfrontends served from main domain)
 * - Preview: Only allow the specific Vercel preview URL
 * - Development: Only allow known local dev ports
 *
 * Note: Console app is a microfrontend served from lightfast.ai
 * See: apps/console/microfrontends.json
 */
const getAllowedOrigins = (): Set<string> => {
	const origins = new Set<string>();

	// Production origins (all microfrontends served from lightfast.ai)
	if (env.VERCEL_ENV === "production") {
		origins.add("https://lightfast.ai");
	}

	// Preview deployment origins (Vercel preview URLs)
	if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
		origins.add(`https://${env.VERCEL_URL}`);
	}

	// Development origins (known local ports from microfrontends.json)
	if (env.NODE_ENV === "development") {
		origins.add("http://localhost:4107"); // Console app (local dev)
		origins.add("http://localhost:3024"); // Microfrontends proxy
		origins.add("http://localhost:4101"); // WWW app
		origins.add("http://localhost:4104"); // Auth app
	}

	return origins;
};

const setCorsHeaders = (req: NextRequest, res: Response) => {
	const originHeader = req.headers.get("origin");
	const allowedOrigins = getAllowedOrigins();

	// Check if origin is in allowed list
	const allowOrigin =
		originHeader && allowedOrigins.has(originHeader) ? originHeader : null;

	// Reject requests from unauthorized origins
	if (!allowOrigin) {
		return res;
	}

	res.headers.set("Access-Control-Allow-Origin", allowOrigin);
	res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
	res.headers.set(
		"Access-Control-Allow-Headers",
		"content-type,authorization,x-trpc-source",
	);
	res.headers.set("Vary", "Origin");
	res.headers.set("Access-Control-Allow-Credentials", "true");

	return res;
};

export const OPTIONS = (req: NextRequest) => {
	const response = new Response(null, {
		status: 204,
	});
	return setCorsHeaders(req, response);
};

/**
 * User-scoped tRPC endpoint
 * Handles procedures that allow pending users (no org required)
 * Examples: organization.create, account.profile.get
 */
const handler = async (req: NextRequest) => {
	const response = await fetchRequestHandler({
		endpoint: "/api/trpc/user",
		router: userRouter,
		req,
		createContext: () =>
			createUserTRPCContext({
				headers: req.headers,
			}),
		onError({ error, path }) {
			console.error(`>>> tRPC Error on 'user.${path}'`, error);
		},
	});

	return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
