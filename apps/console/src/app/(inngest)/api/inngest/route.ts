/**
 * Inngest API route handler
 * Serves Inngest workflows for console application
 *
 * @see https://www.inngest.com/docs/sdk/serve
 */

import { createInngestRouteContext } from "@api/console/inngest";
import type { NextRequest } from "next/server";

// Create handlers from Inngest route context
const handlers = createInngestRouteContext();

/**
 * GET handler - Inngest introspection endpoint
 *
 * Used by Inngest dev server and cloud to discover registered functions
 */
export const GET = handlers.GET as unknown as (
	request: NextRequest,
	context: { params: Promise<object> },
) => Promise<Response>;

/**
 * POST handler - Execute Inngest functions
 *
 * Receives events and executes registered workflow functions
 */
export const POST = handlers.POST as unknown as (
	request: NextRequest,
	context: { params: Promise<object> },
) => Promise<Response>;

/**
 * PUT handler - Inngest registration endpoint
 *
 * Used by Inngest cloud to register functions
 */
export const PUT = handlers.PUT as unknown as (
	request: NextRequest,
	context: { params: Promise<object> },
) => Promise<Response>;
