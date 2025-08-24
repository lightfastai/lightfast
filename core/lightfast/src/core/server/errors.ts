/**
 * Base error class for all API errors
 */
export abstract class ApiError extends Error {
	abstract readonly statusCode: number;
	abstract readonly errorCode: string;

	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}

	toJSON() {
		return {
			error: this.message,
			code: this.errorCode,
			statusCode: this.statusCode,
		};
	}
}

/**
 * 400 Bad Request base class
 */
export abstract class BadRequestError extends ApiError {
	readonly statusCode = 400;
}

/**
 * Generic 400 Bad Request error
 */
export class GenericBadRequestError extends BadRequestError {
	readonly errorCode = "BAD_REQUEST";
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends ApiError {
	readonly statusCode = 401;
	readonly errorCode = "UNAUTHORIZED";

	constructor(message = "Unauthorized") {
		super(message);
	}
}

/**
 * 403 Forbidden
 */
export abstract class ForbiddenError extends ApiError {
	readonly statusCode = 403;
}

/**
 * 404 Not Found
 */
export abstract class NotFoundError extends ApiError {
	readonly statusCode = 404;
}

/**
 * 405 Method Not Allowed
 */
export class MethodNotAllowedError extends ApiError {
	readonly statusCode = 405;
	readonly errorCode = "METHOD_NOT_ALLOWED";

	constructor(method: string, allowed: string[]) {
		super(
			`Method ${method} not allowed. Allowed methods: ${allowed.join(", ")}`,
		);
	}
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends ApiError {
	readonly statusCode = 500;
	readonly errorCode = "INTERNAL_SERVER_ERROR";

	constructor(
		message = "Internal server error",
		public readonly cause?: Error,
	) {
		super(message);
	}
}

/**
 * Specific error for invalid path format
 */
export class InvalidPathError extends BadRequestError {
	readonly errorCode = "INVALID_PATH";

	constructor(expectedFormat: string) {
		super(`Invalid path: expected ${expectedFormat}`);
	}
}

/**
 * Specific error for missing agent
 */
export class AgentNotFoundError extends NotFoundError {
	readonly errorCode = "AGENT_NOT_FOUND";

	constructor(agentId: string) {
		super(`Agent '${agentId}' not found`);
	}
}

/**
 * Specific error for session ownership
 */
export class SessionForbiddenError extends ForbiddenError {
	readonly errorCode = "SESSION_FORBIDDEN";

	constructor() {
		super("Session belongs to another user");
	}
}

/**
 * Specific error for session not found
 */
export class SessionNotFoundError extends NotFoundError {
	readonly errorCode = "SESSION_NOT_FOUND";

	constructor() {
		super("Session not found or unauthorized");
	}
}

/**
 * Specific error for missing messages
 */
export class NoMessagesError extends BadRequestError {
	readonly errorCode = "NO_MESSAGES";

	constructor() {
		super("At least one message is required");
	}
}

/**
 * Specific error for missing user message
 */
export class NoUserMessageError extends BadRequestError {
	readonly errorCode = "NO_USER_MESSAGE";

	constructor() {
		super("No recent user message found");
	}
}

/**
 * Memory operation errors
 */
export class MemoryError extends ApiError {
	readonly statusCode = 500;
	readonly errorCode = "MEMORY_ERROR";

	constructor(operation: string, cause?: Error) {
		super(`Memory operation failed: ${operation}`);
	}
}

/**
 * Session creation error
 */
export class SessionCreationError extends BadRequestError {
	readonly errorCode = "SESSION_CREATION_ERROR";

	constructor(message: string) {
		super(`Session creation failed: ${message}`);
	}
}

/**
 * Message operation error
 */
export class MessageOperationError extends BadRequestError {
	readonly errorCode = "MESSAGE_OPERATION_ERROR";

	constructor(operation: string, message: string) {
		super(`Message ${operation} failed: ${message}`);
	}
}

/**
 * Stream operation error
 */
export class StreamOperationError extends ApiError {
	readonly statusCode = 500;
	readonly errorCode = "STREAM_OPERATION_ERROR";

	constructor(operation: string, message: string) {
		super(`Stream ${operation} failed: ${message}`);
	}
}

/**
 * Agent streaming error - for errors during agent stream execution
 */
export class AgentStreamError extends ApiError {
	readonly statusCode = 500;
	readonly errorCode = "AGENT_STREAM_ERROR";

	constructor(message: string, public readonly cause?: Error) {
		super(`Agent streaming failed: ${message}`);
	}
}

/**
 * Agent configuration error - for invalid agent setup
 */
export class AgentConfigurationError extends BadRequestError {
	readonly errorCode = "AGENT_CONFIGURATION_ERROR";

	constructor(field: string, details?: string) {
		super(`Agent configuration error: ${field}${details ? ` - ${details}` : ""}`);
	}
}

/**
 * Tool execution error - for errors during tool creation or execution
 */
export class ToolExecutionError extends ApiError {
	readonly statusCode = 500;
	readonly errorCode = "TOOL_EXECUTION_ERROR";

	constructor(toolName: string, message: string, public readonly cause?: Error) {
		super(`Tool execution failed: ${toolName} - ${message}`);
	}
}

/**
 * Context creation error - for errors during runtime/request context creation
 */
export class ContextCreationError extends BadRequestError {
	readonly errorCode = "CONTEXT_CREATION_ERROR";

	constructor(contextType: string, message?: string, public readonly cause?: Error) {
		super(`Failed to create ${contextType} context${message ? `: ${message}` : ""}`);
	}
}

/**
 * Cache operation error - for errors during cache operations
 */
export class CacheOperationError extends ApiError {
	readonly statusCode = 500;
	readonly errorCode = "CACHE_OPERATION_ERROR";

	constructor(operation: string, message?: string, public readonly cause?: Error) {
		super(`Cache operation failed: ${operation}${message ? ` - ${message}` : ""}`);
	}
}

/**
 * Message conversion error - for errors during message format conversion
 */
export class MessageConversionError extends BadRequestError {
	readonly errorCode = "MESSAGE_CONVERSION_ERROR";

	constructor(operation: string, message?: string, public readonly cause?: Error) {
		super(`Message conversion failed: ${operation}${message ? ` - ${message}` : ""}`);
	}
}

/**
 * Helper to convert unknown errors to ApiError
 */
export function toApiError(error: unknown): ApiError {
	if (error instanceof ApiError) {
		return error;
	}

	if (error instanceof Error) {
		return new InternalServerError(error.message, error);
	}

	return new InternalServerError(String(error));
}

/**
 * Helper to convert memory operation errors to appropriate ApiError types
 * This function intelligently maps common error patterns to the right HTTP status codes
 */
export function toMemoryApiError(error: unknown, operation: string): ApiError {
	if (error instanceof ApiError) {
		return error;
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		// Handle authentication/authorization errors
		if (
			message.includes("unauthorized") ||
			message.includes("session expired") ||
			message.includes("invalid")
		) {
			return new UnauthorizedError(error.message);
		}

		if (
			message.includes("forbidden") ||
			message.includes("access denied") ||
			message.includes("belongs to another user")
		) {
			return new SessionForbiddenError();
		}

		if (message.includes("not found") && message.includes("session")) {
			return new SessionNotFoundError();
		}

		// Handle specific operation errors
		if (operation === "createSession") {
			return new SessionCreationError(error.message);
		}

		if (operation === "appendMessage" || operation === "getMessages") {
			return new MessageOperationError(operation, error.message);
		}

		if (operation === "createStream" || operation === "getSessionStreams") {
			return new StreamOperationError(operation, error.message);
		}

		// Default to memory error for other cases
		return new MemoryError(operation, error);
	}

	return new MemoryError(operation);
}

/**
 * Helper to convert agent operation errors to appropriate ApiError types
 * This function intelligently maps agent errors and provides fallbacks for unknown errors
 */
export function toAgentApiError(error: unknown, operation: string): ApiError {
	if (error instanceof ApiError) {
		return error; // Already a proper lightfast error
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		// Pattern matching for common agent error patterns
		if (message.includes("model") && message.includes("configuration")) {
			return new AgentConfigurationError("model", error.message);
		}

		if (message.includes("context") && message.includes("creation")) {
			return new ContextCreationError("runtime", error.message, error);
		}

		if (message.includes("tool") && (message.includes("factory") || message.includes("execution"))) {
			return new ToolExecutionError("unknown", error.message, error);
		}

		if (message.includes("cache") && message.includes("operation")) {
			return new CacheOperationError(operation, error.message, error);
		}

		if (message.includes("message") && message.includes("conversion")) {
			return new MessageConversionError(operation, error.message, error);
		}

		if (message.includes("no messages") || message.includes("messages required")) {
			return new NoMessagesError();
		}

		// Operation-specific mapping
		if (operation === "stream") {
			return new AgentStreamError(error.message, error);
		}

		if (operation === "createRuntimeContext") {
			return new ContextCreationError("runtime", error.message, error);
		}

		if (operation === "resolveTools") {
			return new ToolExecutionError("factory", error.message, error);
		}

		// Default to agent stream error for unknown errors
		return new AgentStreamError(`${operation}: ${error.message}`, error);
	}

	// Handle non-Error thrown values
	return new AgentStreamError(`${operation}: ${String(error)}`);
}

/**
 * Type guard for ApiError
 */
export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}
