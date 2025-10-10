import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@db/deus/client";
import { DeusApiKey, DeusSession, organizations } from "@db/deus/schema";

/**
 * POST /api/chat/[orgSlug]/[sessionId]
 *
 * AI-based routing decisions for Deus CLI
 *
 * This route is called by the CLI to determine which agent to use
 * and which MCP servers to enable based on the user's request.
 *
 * Authentication: API key via Authorization: Bearer deus_sk_...
 */

// Use Edge runtime for performance
export const runtime = "edge";

/**
 * Request schema
 */
const requestSchema = z.object({
	message: z.string().min(1, "Message is required"),
});

/**
 * Response schema - matches the routing decision from core/deus
 */
const routeDecisionSchema = z.object({
	agent: z.enum(["claude-code", "codex"]),
	mcpServers: z.array(z.string()),
	reasoning: z.string(),
});

type RouteDecision = z.infer<typeof routeDecisionSchema>;

/**
 * Deus System Prompt
 * Based on core/deus/src/lib/system-prompt.ts
 */
const DEUS_SYSTEM_PROMPT = `You are Deus, an AI orchestrator that routes tasks to specialized agents.

Available agents:
- claude-code: Code review, debugging, refactoring, documentation, git operations
- codex: Testing, web automation, Playwright, browser tasks, E2E testing

Analyze the user's request and determine:
1. Which agent should handle this task
2. Which MCP servers are needed (if any)
3. Your reasoning for this decision

Available MCP servers:
- playwright: Browser automation
- browserbase: Cloud browser sessions
- deus-session: Session management (always included)

Examples:
- "Review the auth code" → agent: claude-code, mcpServers: [], reasoning: "Code review task"
- "Write tests with Playwright" → agent: codex, mcpServers: ["playwright"], reasoning: "Browser testing"
- "Debug the login flow" → agent: claude-code, mcpServers: [], reasoning: "Debugging requires code analysis"
- "Scrape this website" → agent: codex, mcpServers: ["playwright", "browserbase"], reasoning: "Web scraping with browser"`;

/**
 * Error types for proper error handling
 */
enum ErrorType {
	UNAUTHORIZED = "UNAUTHORIZED",
	NOT_FOUND = "NOT_FOUND",
	BAD_REQUEST = "BAD_REQUEST",
	FORBIDDEN = "FORBIDDEN",
	INTERNAL_ERROR = "INTERNAL_ERROR",
}

interface ErrorResponse {
	type: ErrorType;
	error: string;
	message: string;
}

/**
 * Generate a request ID for debugging
 */
function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Hash an API key using SHA-256
 * Same logic as api/deus/src/router/api-key.ts
 */
async function hashApiKey(key: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(key);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Authenticate and validate API key
 */
async function authenticateApiKey(authHeader: string | null): Promise<{
	userId: string;
	organizationId: string;
	scopes: string[];
} | null> {
	if (!authHeader?.startsWith("Bearer deus_sk_")) {
		return null;
	}

	const key = authHeader.replace("Bearer ", "");
	const keyHash = await hashApiKey(key);

	// Find the API key by hash
	const keyResult = await db
		.select({
			id: DeusApiKey.id,
			userId: DeusApiKey.userId,
			organizationId: DeusApiKey.organizationId,
			scopes: DeusApiKey.scopes,
			expiresAt: DeusApiKey.expiresAt,
			revokedAt: DeusApiKey.revokedAt,
		})
		.from(DeusApiKey)
		.where(eq(DeusApiKey.keyHash, keyHash))
		.limit(1);

	const apiKey = keyResult[0];

	if (!apiKey) {
		return null;
	}

	// Check if revoked
	if (apiKey.revokedAt) {
		return null;
	}

	// Check if expired
	if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
		return null;
	}

	// Update lastUsedAt asynchronously (don't block request)
	void db
		.update(DeusApiKey)
		.set({ lastUsedAt: new Date().toISOString() })
		.where(eq(DeusApiKey.id, apiKey.id));

	return {
		userId: apiKey.userId,
		organizationId: apiKey.organizationId,
		scopes: apiKey.scopes,
	};
}

/**
 * POST handler
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ orgSlug: string; sessionId: string }> }
) {
	const requestId = generateRequestId();
	const { orgSlug, sessionId } = await params;

	try {
		// 1. Authenticate API key
		const authHeader = request.headers.get("authorization");
		const apiKeyAuth = await authenticateApiKey(authHeader);

		if (!apiKeyAuth) {
			return NextResponse.json<ErrorResponse>(
				{
					type: ErrorType.UNAUTHORIZED,
					error: "Invalid API key",
					message: "Provide a valid API key in the Authorization header: 'Bearer deus_sk_...'",
				},
				{
					status: 401,
					headers: { "x-request-id": requestId },
				}
			);
		}

		// 2. Verify organization exists and matches orgSlug
		const orgResult = await db
			.select({
				id: organizations.id,
				githubOrgSlug: organizations.githubOrgSlug,
			})
			.from(organizations)
			.where(eq(organizations.githubOrgSlug, orgSlug))
			.limit(1);

		const org = orgResult[0];

		if (!org) {
			return NextResponse.json<ErrorResponse>(
				{
					type: ErrorType.NOT_FOUND,
					error: "Organization not found",
					message: `No organization found with slug: ${orgSlug}`,
				},
				{
					status: 404,
					headers: { "x-request-id": requestId },
				}
			);
		}

		// 3. Verify API key's organization matches the requested organization
		if (apiKeyAuth.organizationId !== org.id) {
			return NextResponse.json<ErrorResponse>(
				{
					type: ErrorType.FORBIDDEN,
					error: "Organization mismatch",
					message: "API key does not belong to this organization",
				},
				{
					status: 403,
					headers: { "x-request-id": requestId },
				}
			);
		}

		// 4. Look up the session
		const sessionResult = await db
			.select({
				id: DeusSession.id,
				organizationId: DeusSession.organizationId,
				cwd: DeusSession.cwd,
				metadata: DeusSession.metadata,
				currentAgent: DeusSession.currentAgent,
			})
			.from(DeusSession)
			.where(eq(DeusSession.id, sessionId))
			.limit(1);

		const session = sessionResult[0];

		if (!session) {
			return NextResponse.json<ErrorResponse>(
				{
					type: ErrorType.NOT_FOUND,
					error: "Session not found",
					message: `No session found with ID: ${sessionId}`,
				},
				{
					status: 404,
					headers: { "x-request-id": requestId },
				}
			);
		}

		// 5. Verify session belongs to the organization
		if (session.organizationId !== org.id) {
			return NextResponse.json<ErrorResponse>(
				{
					type: ErrorType.FORBIDDEN,
					error: "Session organization mismatch",
					message: "Session does not belong to this organization",
				},
				{
					status: 403,
					headers: { "x-request-id": requestId },
				}
			);
		}

		// 6. Parse and validate request body
		const body: unknown = await request.json();
		const parseResult = requestSchema.safeParse(body);

		if (!parseResult.success) {
			return NextResponse.json<ErrorResponse>(
				{
					type: ErrorType.BAD_REQUEST,
					error: "Invalid request body",
					message: parseResult.error.errors[0]?.message ?? "Invalid request",
				},
				{
					status: 400,
					headers: { "x-request-id": requestId },
				}
			);
		}

		const { message } = parseResult.data;

		// 7. Build context for AI routing
		const contextParts: string[] = [
			`Current working directory: ${session.cwd}`,
		];

		if (session.metadata?.git) {
			const git = session.metadata.git;
			if (git.branch) contextParts.push(`Git branch: ${git.branch}`);
			if (git.remote) contextParts.push(`Git remote: ${git.remote}`);
		}

		if (session.currentAgent) {
			contextParts.push(`Previous agent: ${session.currentAgent}`);
		}

		const context = contextParts.join("\n");
		const promptWithContext = `${context}\n\nUser request: ${message}`;

		// 8. Call AI for routing decision
		const { object: decision } = await generateObject({
			model: gateway("anthropic/claude-4-sonnet"),
			system: DEUS_SYSTEM_PROMPT,
			prompt: promptWithContext,
			schema: routeDecisionSchema,
			temperature: 0.2,
		});

		// 9. Log the routing decision
		console.log(`[Deus Router] ${requestId} - ${message} → ${decision.agent} (${decision.reasoning})`);

		// 10. Return the routing decision
		return NextResponse.json<RouteDecision>(
			decision,
			{
				status: 200,
				headers: { "x-request-id": requestId },
			}
		);
	} catch (error) {
		console.error(`[Deus Router] ${requestId} - Error:`, error);

		return NextResponse.json<ErrorResponse>(
			{
				type: ErrorType.INTERNAL_ERROR,
				error: "Internal server error",
				message: error instanceof Error ? error.message : "An unexpected error occurred",
			},
			{
				status: 500,
				headers: { "x-request-id": requestId },
			}
		);
	}
}
