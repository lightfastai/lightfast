import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gateway } from "@ai-sdk/gateway";
import { stepCountIs } from "ai";
import type { DeusAppRuntimeContext } from "@repo/deus-types";
import type { LightfastAppDeusUIMessage } from "@repo/deus-types";
import { uuidv4 } from "@repo/lib";
import { createAgent } from "lightfast/agent";
import { fetchRequestHandler } from "lightfast/server/adapters/fetch";
import { ApiKeysService, OrganizationsService, SessionsService } from "@repo/deus-api-services";
import { deusTools } from "./_lib/tools";
import { DeusMemory } from "./_lib/memory";

/**
 * Request body type for CLI requests
 */
interface DeusRequestBody {
	message?: string;
	messages?: LightfastAppDeusUIMessage[];
}

/**
 * POST /api/chat/[orgSlug]/[sessionId]
 *
 * AI-based streaming chat for Deus CLI with tool calling
 *
 * This route supports long-running conversations where Deus can:
 * - Decide which agent to use (Claude Code or Codex)
 * - Execute tasks via the run_coding_tool
 * - Maintain conversation history
 *
 * Authentication: API key via Authorization: Bearer deus_sk_...
 */

// Note: Using Node.js runtime (not Edge) due to dependencies requiring node:crypto
// export const runtime = "edge";

/**
 * Deus System Prompt
 * Based on core/deus/src/lib/system-prompt.ts
 */
const DEUS_SYSTEM_PROMPT = `You are Deus, an AI orchestrator that routes tasks to specialized coding agents.

Available agents:
- claude-code: Code review, debugging, refactoring, documentation, git operations, general coding tasks
- codex: Testing, web automation, Playwright, browser tasks, E2E testing

Your job is to:
1. Analyze the user's coding request
2. Determine which agent should handle it
3. Use the run_coding_tool to execute the task

Available MCP servers (optional):
- playwright: Browser automation
- browserbase: Cloud browser sessions
- deus-session: Session management (auto-included)

Guidelines:
- For code-related tasks (review, debug, refactor, implement): use claude-code
- For testing and browser automation: use codex
- Always provide a clear explanation of your decision
- Include relevant MCP servers when needed

Examples:
- "Review the auth code" → run_coding_tool(type: "claude-code", task: "Review the authentication code")
- "Write Playwright tests" → run_coding_tool(type: "codex", task: "Write Playwright tests", mcpServers: ["playwright"])
- "Debug login flow" → run_coding_tool(type: "claude-code", task: "Debug the login flow")
- "Scrape this website" → run_coding_tool(type: "codex", task: "Scrape this website", mcpServers: ["playwright", "browserbase"])`;

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
 * Authenticate and validate API key using ApiKeysService
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

	try {
		const apiKeysService = new ApiKeysService();
		const result = await apiKeysService.verifyApiKey(key);
		return result;
	} catch {
		// Key is invalid, revoked, or expired
		return null;
	}
}

/**
 * POST handler
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ orgSlug: string; sessionId: string }> },
) {
	const requestId = generateRequestId();
	const { orgSlug, sessionId } = await params;

	console.log(`[Deus API] ${requestId} - Received request`, {
		orgSlug,
		sessionId,
		method: request.method,
		url: request.url,
		headers: {
			contentType: request.headers.get("content-type"),
			authorization: request.headers.get("authorization")?.slice(0, 20) + "...",
		},
	});

	try {
		// Log request body
		const body = await request.text();
		console.log(`[Deus API] ${requestId} - Request body:`, {
			bodyLength: body.length,
			bodyPreview: body.slice(0, 200),
		});

		// Parse and transform the request body
		let parsedBody: DeusRequestBody = {};
		try {
			parsedBody = JSON.parse(body) as DeusRequestBody;
			console.log(`[Deus API] ${requestId} - Parsed request body:`, {
				hasMessages: !!parsedBody.messages,
				hasMessage: !!parsedBody.message,
				messagesCount: parsedBody.messages?.length ?? 0,
				messageTypes: parsedBody.messages?.map((m: LightfastAppDeusUIMessage) => m.role) ?? [],
				fullBody: parsedBody,
			});

			// Transform CLI format { message: "text" } to fetchRequestHandler format
			if (parsedBody.message && !parsedBody.messages) {
				console.log(
					`[Deus API] ${requestId} - Converting CLI message format to UIMessage format`,
				);

				// Load existing messages from memory first
				const memory = new DeusMemory();
				const existingMessages = await memory.getMessages(sessionId);

				console.log(
					`[Deus API] ${requestId} - Loaded ${existingMessages.length} existing messages`,
				);

				// Create new user message
				const userMessage = {
					id: uuidv4(),
					role: "user" as const,
					parts: [
						{
							type: "text" as const,
							text: parsedBody.message,
						},
					],
				};

				// Combine with existing messages
				parsedBody = {
					messages: [...existingMessages, userMessage],
				};

				console.log(
					`[Deus API] ${requestId} - Transformed body now has ${parsedBody.messages?.length ?? 0} messages`,
				);
			}
		} catch (e) {
			console.error(`[Deus API] ${requestId} - Failed to parse JSON:`, e);
		}

		// Clone request with transformed body for fetchRequestHandler
		const requestWithBody = new Request(request.url, {
			method: request.method,
			headers: request.headers,
			body: JSON.stringify(parsedBody),
		});
		// 1. Authenticate API key
		const authHeader = request.headers.get("authorization");
		const apiKeyAuth = await authenticateApiKey(authHeader);

		console.log(`[Deus API] ${requestId} - Authentication result:`, {
			authenticated: !!apiKeyAuth,
			userId: apiKeyAuth?.userId,
			organizationId: apiKeyAuth?.organizationId,
		});

		if (!apiKeyAuth) {
			return NextResponse.json<ErrorResponse>(
				{
					type: ErrorType.UNAUTHORIZED,
					error: "Invalid API key",
					message:
						"Provide a valid API key in the Authorization header: 'Bearer deus_sk_...'",
				},
				{
					status: 401,
					headers: { "x-request-id": requestId },
				},
			);
		}

		// 2. Verify organization exists and matches orgSlug using service
		const orgService = new OrganizationsService();
		const orgResult = await orgService.findByGithubOrgSlug(orgSlug);

		if (!orgResult) {
			return NextResponse.json<ErrorResponse>(
				{
					type: ErrorType.NOT_FOUND,
					error: "Organization not found",
					message: `No organization found with slug: ${orgSlug}`,
				},
				{
					status: 404,
					headers: { "x-request-id": requestId },
				},
			);
		}

		// 3. Verify API key's organization matches
		if (apiKeyAuth.organizationId !== orgResult.id) {
			return NextResponse.json<ErrorResponse>(
				{
					type: ErrorType.FORBIDDEN,
					error: "Organization mismatch",
					message: "API key does not belong to this organization",
				},
				{
					status: 403,
					headers: { "x-request-id": requestId },
				},
			);
		}

		// 4. Look up the session using service
		const sessionService = new SessionsService();
		const session = await sessionService.getSessionInternal(sessionId);

		console.log(`[Deus API] ${requestId} - Session lookup:`, {
			found: !!session,
			sessionId,
			cwd: session?.cwd,
			currentAgent: session?.currentAgent,
		});

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
				},
			);
		}

		// 5. Verify session belongs to the organization
		if (session.organizationId !== orgResult.id) {
			return NextResponse.json<ErrorResponse>(
				{
					type: ErrorType.FORBIDDEN,
					error: "Session organization mismatch",
					message: "Session does not belong to this organization",
				},
				{
					status: 403,
					headers: { "x-request-id": requestId },
				},
			);
		}

		// 6. Generate message ID
		const messageId = uuidv4();

		// 7. Build context for AI
		const contextParts: string[] = [
			`Current working directory: ${session.cwd}`,
		];

		if (session.metadata && typeof session.metadata === "object" && "git" in session.metadata) {
			const gitData = (session.metadata as Record<string, unknown>).git;
			if (gitData && typeof gitData === "object" && "branch" in gitData) {
				const branch = (gitData as Record<string, unknown>).branch;
				if (typeof branch === "string") {
					contextParts.push(`Git branch: ${branch}`);
				}
			}
			if (gitData && typeof gitData === "object" && "remote" in gitData) {
				const remote = (gitData as Record<string, unknown>).remote;
				if (typeof remote === "string") {
					contextParts.push(`Git remote: ${remote}`);
				}
			}
		}

		if (session.currentAgent) {
			contextParts.push(`Current agent: ${session.currentAgent}`);
		}

		const context = contextParts.join("\n");

		// 8. Create memory instance
		const memory = new DeusMemory();

		console.log(`[Deus API] ${requestId} - Creating agent with context:`, {
			context: contextParts,
			messageId,
			systemPromptLength: DEUS_SYSTEM_PROMPT.length,
		});

		// 9. Execute with fetchRequestHandler
		console.log(`[Deus API] ${requestId} - Starting fetchRequestHandler...`);
		const response = await fetchRequestHandler({
			agent: createAgent<DeusAppRuntimeContext, typeof deusTools>({
				name: "deus",
				system: `${DEUS_SYSTEM_PROMPT}\n\nContext:\n${context}`,
				tools: deusTools,
				createRuntimeContext: ({
					sessionId: _sessionId,
					resourceId: _resourceId,
				}): DeusAppRuntimeContext => ({
					userId: apiKeyAuth.userId,
					organizationId: apiKeyAuth.organizationId,
					agentId: "deus",
					messageId,
					// No tools runtime config needed - run_coding_tool uses client-side execution
				}),
				model: gateway("anthropic/claude-sonnet-4.5"),
				temperature: 0.2,
				// Allow tool calls to be generated and executed
				// The execute function returns immediately with "completed" status
				// Client will see the tool call in streaming response and handle it
				stopWhen: stepCountIs(5),
			}),
			sessionId,
			memory,
			req: requestWithBody, // Use the cloned request with body
			resourceId: apiKeyAuth.userId,
			context: {},
			createRequestContext: (req) => ({
				userAgent: req.headers.get("user-agent") ?? undefined,
				ipAddress:
					req.headers.get("x-forwarded-for") ??
					req.headers.get("x-real-ip") ??
					undefined,
			}),
			generateId: () => messageId,
			onError(event) {
				const { error, systemContext } = event;
				console.error(
					`[Deus API Error] Session: ${systemContext.sessionId}, User: ${systemContext.resourceId}`,
					{
						error: error.message || JSON.stringify(error),
						stack: error.stack,
						sessionId: systemContext.sessionId,
						userId: systemContext.resourceId,
						method: request.method,
						url: request.url,
					},
				);
			},
		});

		console.log(`[Deus API] ${requestId} - fetchRequestHandler completed, streaming response`);

		// Add telemetry headers
		response.headers.set("x-request-id", requestId);
		response.headers.set("x-session-id", sessionId);
		response.headers.set("x-message-id", messageId);

		console.log(`[Deus API] ${requestId} - Returning response with headers:`, {
			requestId,
			sessionId,
			messageId,
			status: response.status,
			contentType: response.headers.get("content-type"),
		});

		return response;
	} catch (error) {
		console.error(`[Deus Router] ${requestId} - Error:`, error);

		return NextResponse.json<ErrorResponse>(
			{
				type: ErrorType.INTERNAL_ERROR,
				error: "Internal server error",
				message:
					error instanceof Error
						? error.message
						: "An unexpected error occurred",
			},
			{
				status: 500,
				headers: { "x-request-id": requestId },
			},
		);
	}
}
