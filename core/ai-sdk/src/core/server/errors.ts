import { AISDKError } from "ai";
import type {
	LightfastErrorContext} from "./error-classification";
import {
	LightfastErrorCategory,
	LightfastErrorSeverity,
	LightfastErrorSource,
} from "./error-classification";

interface ApiErrorOptions extends LightfastErrorContext {
	readonly cause?: unknown;
}

/**
 * Base error class for all API errors
 */
export abstract class ApiError extends Error {
	abstract readonly statusCode: number;
	abstract readonly errorCode: string;
	readonly category: LightfastErrorCategory;
	readonly severity: LightfastErrorSeverity;
	readonly source: LightfastErrorSource;
	readonly metadata?: Record<string, unknown>;

	protected constructor(message: string, options: ApiErrorOptions = {}) {
		super(message, options.cause ? { cause: options.cause } : undefined);
		this.name = this.constructor.name;
		this.category = options.category ?? LightfastErrorCategory.Unknown;
		this.severity = options.severity ?? LightfastErrorSeverity.Fatal;
		this.source = options.source ?? LightfastErrorSource.LightfastCore;
		this.metadata = options.metadata;
	}

	toJSON() {
		return {
			error: this.message,
			code: this.errorCode,
			statusCode: this.statusCode,
			source: this.source,
			category: this.category,
			severity: this.severity,
			metadata: this.metadata,
		};
	}
}

/**
 * 400 Bad Request base class
 */
export abstract class BadRequestError extends ApiError {
	readonly statusCode = 400;

	protected constructor(message: string, options: ApiErrorOptions = {}) {
		super(message, {
			...options,
			category: options.category ?? LightfastErrorCategory.Request,
			severity: options.severity ?? LightfastErrorSeverity.Recoverable,
		});
	}
}

/**
 * Generic 400 Bad Request error
 */
export class GenericBadRequestError extends BadRequestError {
	readonly errorCode = "BAD_REQUEST";

	constructor(message: string, options: ApiErrorOptions = {}) {
		super(message, options);
	}
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends ApiError {
	readonly statusCode = 401;
	readonly errorCode = "UNAUTHORIZED";

	constructor(message = "Unauthorized", options: ApiErrorOptions = {}) {
		super(message, {
			...options,
			category: options.category ?? LightfastErrorCategory.Authentication,
			severity: options.severity ?? LightfastErrorSeverity.Fatal,
		});
	}
}

/**
 * 403 Forbidden
 */
export abstract class ForbiddenError extends ApiError {
	readonly statusCode = 403;

	protected constructor(message: string, options: ApiErrorOptions = {}) {
		super(message, {
			...options,
			category: options.category ?? LightfastErrorCategory.Authorization,
			severity: options.severity ?? LightfastErrorSeverity.Fatal,
		});
	}
}

/**
 * 404 Not Found
 */
export abstract class NotFoundError extends ApiError {
	readonly statusCode = 404;

	protected constructor(message: string, options: ApiErrorOptions = {}) {
		super(message, {
			...options,
			category: options.category ?? LightfastErrorCategory.Request,
			severity: options.severity ?? LightfastErrorSeverity.Recoverable,
		});
	}
}

/**
 * 405 Method Not Allowed
 */
export class MethodNotAllowedError extends ApiError {
	readonly statusCode = 405;
	readonly errorCode = "METHOD_NOT_ALLOWED";

	constructor(method: string, allowed: string[], options: ApiErrorOptions = {}) {
		super(
			`Method ${method} not allowed. Allowed methods: ${allowed.join(", ")}`,
			{
				...options,
				category: options.category ?? LightfastErrorCategory.Request,
				severity: options.severity ?? LightfastErrorSeverity.Recoverable,
			},
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
		cause?: Error,
		options: ApiErrorOptions = {},
	) {
		super(message, {
			...options,
			cause,
			category: options.category ?? LightfastErrorCategory.Unknown,
			severity: options.severity ?? LightfastErrorSeverity.Fatal,
		});
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

	constructor(operation: string, cause?: Error, options: ApiErrorOptions = {}) {
		super(`Memory operation failed: ${operation}`,
			{
				...options,
				cause,
				source: options.source ?? LightfastErrorSource.Memory,
				category: options.category ?? LightfastErrorCategory.Infrastructure,
				severity: options.severity ?? LightfastErrorSeverity.Fatal,
			});
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

	constructor(operation: string, message: string, options: ApiErrorOptions = {}) {
		super(`Message ${operation} failed: ${message}`,
			{
				...options,
				category: options.category ?? LightfastErrorCategory.Persistence,
			});
	}
}

/**
 * Stream operation error
 */
export class StreamOperationError extends ApiError {
	readonly statusCode = 500;
	readonly errorCode = "STREAM_OPERATION_ERROR";

	constructor(operation: string, message: string, options: ApiErrorOptions = {}) {
		super(`Stream ${operation} failed: ${message}`,
			{
				...options,
				category: options.category ?? LightfastErrorCategory.Stream,
				severity: options.severity ?? LightfastErrorSeverity.Recoverable,
			});
	}
}

/**
 * Agent streaming error - for errors during agent stream execution
 */
export class AgentStreamError extends ApiError {
	readonly statusCode = 500;
	readonly errorCode = "AGENT_STREAM_ERROR";

	constructor(message: string, cause?: Error, options: ApiErrorOptions = {}) {
		super(`Agent streaming failed: ${message}`,
			{
				...options,
				cause,
				category: options.category ?? LightfastErrorCategory.Stream,
				severity: options.severity ?? LightfastErrorSeverity.Recoverable,
			});
	}
}

/**
 * Agent configuration error - for invalid agent setup
 */
export class AgentConfigurationError extends BadRequestError {
	readonly errorCode = "AGENT_CONFIGURATION_ERROR";

	constructor(field: string, details?: string, options: ApiErrorOptions = {}) {
		super(`Agent configuration error: ${field}${details ? ` - ${details}` : ""}`,
			{
				...options,
				category: options.category ?? LightfastErrorCategory.Model,
			});
	}
}

/**
 * Tool execution error - for errors during tool creation or execution
 */
export class ToolExecutionError extends ApiError {
	readonly statusCode = 500;
	readonly errorCode = "TOOL_EXECUTION_ERROR";

	constructor(toolName: string, message: string, cause?: Error, options: ApiErrorOptions = {}) {
		super(`Tool execution failed: ${toolName} - ${message}`,
			{
				...options,
				cause,
				category: options.category ?? LightfastErrorCategory.Tool,
				severity: options.severity ?? LightfastErrorSeverity.Recoverable,
			});
	}
}

/**
 * Context creation error - for errors during runtime/request context creation
 */
export class ContextCreationError extends BadRequestError {
	readonly errorCode = "CONTEXT_CREATION_ERROR";

	constructor(contextType: string, message?: string, cause?: Error, options: ApiErrorOptions = {}) {
		super(`Failed to create ${contextType} context${message ? `: ${message}` : ""}`,
			{
				...options,
				cause,
				category: options.category ?? LightfastErrorCategory.Infrastructure,
			});
	}
}

/**
 * Cache operation error - for errors during cache operations
 */
export class CacheOperationError extends ApiError {
	readonly statusCode = 500;
	readonly errorCode = "CACHE_OPERATION_ERROR";

	constructor(operation: string, message?: string, cause?: Error, options: ApiErrorOptions = {}) {
		super(`Cache operation failed: ${operation}${message ? ` - ${message}` : ""}`,
			{
				...options,
				cause,
				category: options.category ?? LightfastErrorCategory.Cache,
				severity: options.severity ?? LightfastErrorSeverity.Recoverable,
			});
	}
}

/**
 * Message conversion error - for errors during message format conversion
 */
export class MessageConversionError extends BadRequestError {
	readonly errorCode = "MESSAGE_CONVERSION_ERROR";

	constructor(operation: string, message?: string, cause?: Error, options: ApiErrorOptions = {}) {
		super(`Message conversion failed: ${operation}${message ? ` - ${message}` : ""}`,
			{
				...options,
				cause,
				category: options.category ?? LightfastErrorCategory.Validation,
			});
	}
}

class AiSdkApiError extends ApiError {
	readonly statusCode: number;
	readonly errorCode: string;

	constructor(
		params: {
			message: string;
			statusCode: number;
			errorCode: string;
			options?: ApiErrorOptions;
		},
	) {
		super(params.message, {
			...params.options,
			source: params.options?.source ?? LightfastErrorSource.AiSdk,
		});
		this.statusCode = params.statusCode;
		this.errorCode = params.errorCode;
	}
}

const normalizeAiSdkErrorCode = (code: string): string =>
	code
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/_{2,}/g, "_")
		.toUpperCase() || "AI_SDK_ERROR";

function mapAiSdkErrorToApiError(error: AISDKError, operation: string): ApiError {
	const baseMetadata: Record<string, unknown> = {
		aisRetryable:
			"isRetryable" in error && typeof (error as { isRetryable?: unknown }).isRetryable === "boolean"
				? (error as { isRetryable?: boolean }).isRetryable
				: undefined,
		aisAiSdkError: true,
		errorName: error.name,
	};

	if ((error as { statusCode?: unknown }).statusCode !== undefined) {
		baseMetadata.aiSdkStatusCode = (error as { statusCode?: unknown }).statusCode;
	}

	const lowerName = error.name.toLowerCase();
	const errorWithStatusCode = error as { statusCode?: number };
	let statusCode = typeof errorWithStatusCode.statusCode === "number"
		? errorWithStatusCode.statusCode
		: undefined;

	let category = LightfastErrorCategory.Stream;
	let severity = LightfastErrorSeverity.Recoverable;

	if (statusCode === undefined) {
		if (lowerName.includes("invalid") || lowerName.includes("argument")) {
			statusCode = 400;
			category = LightfastErrorCategory.Validation;
			severity = LightfastErrorSeverity.Recoverable;
		} else if (lowerName.includes("auth")) {
			statusCode = 401;
			category = LightfastErrorCategory.Authentication;
			severity = LightfastErrorSeverity.Fatal;
		} else if (lowerName.includes("rate") && lowerName.includes("limit")) {
			statusCode = 429;
			category = LightfastErrorCategory.RateLimit;
			severity = LightfastErrorSeverity.Transient;
		} else if (lowerName.includes("model")) {
			statusCode = 404;
			category = LightfastErrorCategory.Model;
			severity = LightfastErrorSeverity.Recoverable;
		} else if (lowerName.includes("tool")) {
			statusCode = 400;
			category = LightfastErrorCategory.Tool;
			severity = LightfastErrorSeverity.Recoverable;
		} else {
			statusCode = 500;
			category = LightfastErrorCategory.Model;
			severity = LightfastErrorSeverity.Transient;
		}
	}

	if (statusCode >= 500) {
		category = category === LightfastErrorCategory.Stream ? LightfastErrorCategory.Model : category;
		severity = LightfastErrorSeverity.Transient;
	}

	if (statusCode === 429) {
		category = LightfastErrorCategory.RateLimit;
		severity = LightfastErrorSeverity.Transient;
	}

	if (statusCode === 401) {
		category = LightfastErrorCategory.Authentication;
		severity = LightfastErrorSeverity.Fatal;
	}

	if (statusCode === 403) {
		category = LightfastErrorCategory.Authorization;
		severity = LightfastErrorSeverity.Fatal;
	}

	if (statusCode >= 400 && statusCode < 500 && category === LightfastErrorCategory.Stream) {
		category = LightfastErrorCategory.Request;
		severity = LightfastErrorSeverity.Recoverable;
	}

	const message = `${operation}: ${error.message}`;
	const errorCode = normalizeAiSdkErrorCode(error.name);

	const metadata = {
		...Object.fromEntries(
			Object.entries(baseMetadata).filter(([, value]) => value !== undefined),
		),
		operation,
	};

	return new AiSdkApiError({
		message,
		statusCode,
		errorCode,
		options: {
			category,
			severity,
			metadata,
		},
	});
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

	if (AISDKError.isInstance(error)) {
		return mapAiSdkErrorToApiError(error, operation);
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
