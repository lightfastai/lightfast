import { captureException } from "@sentry/nextjs";

export interface ServerActionErrorContext {
	action: string;
	component?: string;
	email?: string;
	[key: string]: unknown;
}

export interface ServerActionErrorResult {
	message: string;
	userMessage: string;
	code?: string;
	isRateLimit?: boolean;
	isAlreadyExists?: boolean;
}

/**
 * Comprehensive server action error handler that:
 * 1. Extracts meaningful error messages from Clerk API errors
 * 2. Captures to Sentry with full context
 * 3. Returns user-friendly messages and metadata
 */
export function handleServerActionError(
	error: unknown,
	context: ServerActionErrorContext
): ServerActionErrorResult {
	let message = "An unexpected error occurred";
	let code: string | undefined;
	let userMessage = "Something went wrong. Please try again.";
	let isRateLimit = false;
	let isAlreadyExists = false;

	// Extract error details
	if (error instanceof Error) {
		message = error.message;
		
		// Check for specific error types
		if (message.toLowerCase().includes("rate limit")) {
			isRateLimit = true;
			userMessage = "Too many attempts. Please wait a moment and try again.";
		} else if (message.toLowerCase().includes("already")) {
			isAlreadyExists = true;
			userMessage = "This email is already on the waitlist!";
		} else if (message.toLowerCase().includes("invalid") || message.toLowerCase().includes("valid email")) {
			userMessage = "Please enter a valid email address.";
		} else if (message.toLowerCase().includes("network") || message.toLowerCase().includes("fetch")) {
			userMessage = "Network error. Please check your connection and try again.";
		}
	}

	// Create a descriptive error for Sentry
	const sentryError = new Error(`[ServerAction:${context.action}] ${message}`);
	
	// Preserve original error as cause for full stack trace
	Object.defineProperty(sentryError, 'cause', {
		value: error,
		enumerable: false,
		writable: true,
		configurable: true
	});

	// Capture to Sentry with comprehensive context
	captureException(sentryError, {
		tags: {
			action: context.action,
			component: context.component ?? 'server-action',
			error_type: isRateLimit ? 'rate_limit' : isAlreadyExists ? 'duplicate_entry' : 'validation',
		},
		extra: {
			...context,
			errorMessage: message,
			userMessage,
			originalError: error instanceof Error ? {
				message: error.message,
				stack: error.stack,
				name: error.name
			} : error,
			isRateLimit,
			isAlreadyExists,
		},
		level: isRateLimit ? 'warning' : 'error',
	});

	return {
		message,
		userMessage,
		code,
		isRateLimit,
		isAlreadyExists,
	};
}

/**
 * Handle Clerk API specific errors with detailed context
 */
export function handleClerkAPIError(
	error: unknown,
	context: ServerActionErrorContext & { 
		clerkTraceId?: string;
		status?: number;
	}
): ServerActionErrorResult {
	const baseResult = handleServerActionError(error, {
		...context,
		component: 'clerk-api',
	});

	// If we have a Clerk trace ID, add it to Sentry context
	if (context.clerkTraceId) {
		captureException(new Error(`Clerk API Error Trace: ${context.clerkTraceId}`), {
			tags: {
				clerk_trace_id: context.clerkTraceId,
				http_status: context.status?.toString(),
			},
			fingerprint: ['clerk-api-error', context.action],
		});
	}

	return baseResult;
}

