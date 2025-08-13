import { env } from "~/env";

/**
 * Development-only error testing commands
 * These commands allow testing error scenarios directly in the chat
 */

export interface TestErrorCommand {
	command: string;
	description: string;
	statusCode: number;
	response: Response;
}

/**
 * Check if message is a test error command
 */
export function isTestErrorCommand(message: string): boolean {
	return env.NODE_ENV === "development" && message.startsWith("/test error");
}

/**
 * Parse test error command and return appropriate response
 */
export function handleTestErrorCommand(message: string): Response | null {
	if (!isTestErrorCommand(message)) {
		return null;
	}

	const command = message.replace("/test error", "").trim();
	console.log(`[Test Mode] Triggering error: ${command}`);

	switch (command) {
		case "rate-limit":
		case "429":
			return new Response(
				JSON.stringify({ 
					error: {
						message: "Too many requests. Please try again later.",
						type: "rate_limit_error",
						code: "rate_limit_exceeded"
					}
				}),
				{ 
					status: 429,
					headers: { 'Content-Type': 'application/json' }
				}
			);

		case "bot":
		case "bot-detection":
			return Response.json(
				{ error: "Bot detection triggered" },
				{ status: 403 }
			);

		case "model-access":
		case "model-denied":
			return Response.json(
				{ 
					error: "Access denied", 
					message: "This model requires authentication. Please sign in to use this model." 
				},
				{ status: 403 }
			);

		case "auth":
		case "401":
			return Response.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);

		case "bad-request":
		case "400":
			return Response.json(
				{ error: "Invalid request format" },
				{ status: 400 }
			);

		case "not-found":
		case "404":
			return Response.json(
				{ error: "Resource not found" },
				{ status: 404 }
			);

		case "server":
		case "500":
			return Response.json(
				{ error: "Internal server error", code: "INTERNAL_SERVER_ERROR" },
				{ status: 500 }
			);

		case "bad-gateway":
		case "502":
			return Response.json(
				{ error: "Bad gateway" },
				{ status: 502 }
			);

		case "unavailable":
		case "503":
			return Response.json(
				{ error: "Service temporarily unavailable" },
				{ status: 503 }
			);

		case "timeout":
		case "504":
			return Response.json(
				{ error: "Gateway timeout" },
				{ status: 504 }
			);

		case "help":
			// Return help message as a successful response
			return Response.json({
				messages: [{
					role: "assistant",
					content: `Available test error commands (dev only):

/test error rate-limit - Trigger rate limit (429)
/test error bot - Trigger bot detection (403)
/test error model-access - Model access denied (403)
/test error auth - Authentication required (401)
/test error bad-request - Bad request (400)
/test error not-found - Not found (404)
/test error server - Server error (500)
/test error bad-gateway - Bad gateway (502)
/test error unavailable - Service unavailable (503)
/test error timeout - Gateway timeout (504)

You can also use HTTP status codes like: /test error 429`
				}]
			});

		default: {
			// Check if it's a status code
			const statusCode = parseInt(command);
			if (!isNaN(statusCode) && statusCode >= 400 && statusCode < 600) {
				return Response.json(
					{ error: `Test error with status ${statusCode}` },
					{ status: statusCode }
				);
			}

			// Unknown command - show help
			return Response.json(
				{ error: `Unknown test command: ${command}. Try '/test error help' for available commands.` },
				{ status: 400 }
			);
		}
	}
}

/**
 * Get all available test commands for documentation
 */
export function getTestCommands(): TestErrorCommand[] {
	return [
		{ command: "rate-limit", description: "Trigger rate limit error", statusCode: 429, response: new Response() },
		{ command: "bot", description: "Trigger bot detection", statusCode: 403, response: new Response() },
		{ command: "model-access", description: "Model access denied", statusCode: 403, response: new Response() },
		{ command: "auth", description: "Authentication required", statusCode: 401, response: new Response() },
		{ command: "bad-request", description: "Bad request error", statusCode: 400, response: new Response() },
		{ command: "not-found", description: "Resource not found", statusCode: 404, response: new Response() },
		{ command: "server", description: "Internal server error", statusCode: 500, response: new Response() },
		{ command: "bad-gateway", description: "Bad gateway error", statusCode: 502, response: new Response() },
		{ command: "unavailable", description: "Service unavailable", statusCode: 503, response: new Response() },
		{ command: "timeout", description: "Gateway timeout", statusCode: 504, response: new Response() },
	];
}