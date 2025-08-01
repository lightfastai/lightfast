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
		super(`Method ${method} not allowed. Allowed methods: ${allowed.join(", ")}`);
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
 * Specific error for thread ownership
 */
export class ThreadForbiddenError extends ForbiddenError {
	readonly errorCode = "THREAD_FORBIDDEN";

	constructor() {
		super("Thread belongs to another user");
	}
}

/**
 * Specific error for thread not found
 */
export class ThreadNotFoundError extends NotFoundError {
	readonly errorCode = "THREAD_NOT_FOUND";

	constructor() {
		super("Thread not found or unauthorized");
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
 * Type guard for ApiError
 */
export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}
