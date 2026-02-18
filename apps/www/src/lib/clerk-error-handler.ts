import { captureException } from "@sentry/nextjs";

/**
 * Error format from Clerk Backend API (direct API calls)
 * Based on Clerk's official Backend API error documentation
 */
interface ClerkBackendAPIError {
	shortMessage: string;
	longMessage: string;
	code: string;
	meta?: Record<string, unknown>;
}

/**
 * Error format from Clerk SDK/Frontend responses
 * Uses an errors array with slightly different field names
 */
interface ClerkSDKError {
	code: string;
	message: string;
	long_message?: string;
	meta?: {
		paramName?: string;
		sessionId?: string;
		emailAddresses?: string[];
		identifiers?: string[];
		permissions?: string[];
		lockout_expires_in_seconds?: number;
		[key: string]: unknown;
	};
}

/**
 * Combined error response type that handles both formats
 */
type _ClerkErrorResponse = 
	// SDK/Frontend format with errors array
	| {
		errors: ClerkSDKError[];
		clerk_trace_id?: string;
	}
	// Direct Backend API format
	| ClerkBackendAPIError;

/**
 * Custom error class that preserves Clerk context
 */
const ClerkErrorCode = {
	// Authentication
	EmailAddressExists: 'email_address_exists',
	FormIdentifierExists: 'form_identifier_exists',
	
	// Rate limiting
	RateLimitExceeded: 'rate_limit_exceeded',
	TooManyRequests: 'too_many_requests',
	
	// User status
	UserLocked: 'user_locked',
	UserBanned: 'user_banned',
	
	// Validation
	FormParameterMissing: 'form_param_missing',
	FormParameterInvalid: 'form_param_invalid',
	RequestBodyInvalid: 'request_body_invalid',
	
	// Authorization
	AuthorizationInvalid: 'authorization_invalid',
	AuthorizationMissing: 'authorization_missing',
} as const;

interface ClerkErrorContext {
	action: string;
	component?: string;
	httpStatus?: number;
	// Don't include sensitive data like emails here
	[key: string]: unknown;
}

interface ClerkErrorResult {
	message: string;
	userMessage: string;
	code?: string;
	isRateLimit: boolean;
	isAlreadyExists: boolean;
	isValidationError: boolean;
	isUserLocked: boolean;
	retryAfterSeconds?: number;
	clerkTraceId?: string;
	shouldLog?: boolean; // Whether to log to Sentry
}

/**
 * Handle errors from Clerk API calls (both direct and SDK)
 * Now returns a ClerkError that can be thrown while preserving context
 */
export function handleClerkError(
	errorData: unknown,
	context: ClerkErrorContext
): ClerkErrorResult {
	// Default values
	let message = "An unexpected error occurred";
	let userMessage = "Something went wrong. Please try again.";
	let code: string | undefined;
	let isRateLimit = false;
	let isAlreadyExists = false;
	let isValidationError = false;
	let isUserLocked = false;
	let retryAfterSeconds: number | undefined;
	let clerkTraceId: string | undefined;
	let shouldLog = true;
	
	// Use HTTP status for detection if available
	if (context.httpStatus) {
		if (context.httpStatus === 429) {
			isRateLimit = true;
			userMessage = "Too many requests. Please wait a moment and try again.";
		} else if (context.httpStatus === 403) {
			// Could be user locked or forbidden
			isUserLocked = true;
		} else if (context.httpStatus >= 500) {
			message = "Clerk service error";
			userMessage = "The service is temporarily unavailable. Please try again later.";
		}
	}
	
	if (!errorData || typeof errorData !== 'object') {
		// Not an object, can't be a Clerk error
		if (errorData instanceof Error) {
			message = errorData.message;
			
			// Check for network errors
			if (errorData.message.includes('fetch failed') || 
				errorData.message.includes('network') ||
				errorData.message.includes('ECONNREFUSED')) {
				userMessage = "Connection error. Please check your internet and try again.";
			}
		}
	} else {
		const response = errorData as Record<string, unknown>;
		
		// Check for SDK/Frontend format (errors array)
		if (Array.isArray(response.errors) && response.errors.length > 0) {
			const firstError = response.errors[0] as ClerkSDKError;
			code = firstError.code;
			message = firstError.long_message ?? firstError.message;
			
			// Extract lockout time if present (ensure it's a number)
			const lockoutTime = firstError.meta?.lockout_expires_in_seconds;
			if (lockoutTime !== undefined) {
				retryAfterSeconds = Number(lockoutTime);
			}
			
			// Store trace ID if available
			if (response.clerk_trace_id) {
				clerkTraceId = response.clerk_trace_id as string;
			}
			
			// Log multiple errors if present (for debugging)
			if (response.errors.length > 1) {
				console.warn(`[Clerk] Multiple errors received, handling first:`, response.errors);
			}
		}
		// Check for Backend API format (direct fields)
		else if (response.code && response.shortMessage) {
			const backendError = response as unknown as ClerkBackendAPIError;
			code = backendError.code;
			message = backendError.longMessage || backendError.shortMessage;
			
			// Extract metadata if present
			const lockoutTime = backendError.meta?.lockout_expires_in_seconds;
			if (lockoutTime !== undefined) {
				retryAfterSeconds = Number(lockoutTime);
			}
		}
		// Handle plain message format (from JSON parse failure)
		else if (response.message && typeof response.message === 'string') {
			message = response.message;
		}
	}
	
	// Map error code to user-friendly message and flags (if not already set by status)
	if (code) {
		switch (code) {
			case ClerkErrorCode.EmailAddressExists:
			case ClerkErrorCode.FormIdentifierExists:
				isAlreadyExists = true;
				userMessage = "This email is already registered.";
				shouldLog = false; // Don't log expected errors
				break;
				
			case ClerkErrorCode.RateLimitExceeded:
			case ClerkErrorCode.TooManyRequests:
				isRateLimit = true;
				userMessage = "Too many attempts. Please wait a moment and try again.";
				shouldLog = false; // Rate limits are expected
				break;
				
			case ClerkErrorCode.UserLocked:
				isUserLocked = true;
				userMessage = retryAfterSeconds 
					? `Account locked. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`
					: "Your account is temporarily locked.";
				break;
				
			case ClerkErrorCode.UserBanned:
				userMessage = "This account has been suspended.";
				break;
				
			case ClerkErrorCode.FormParameterMissing:
				isValidationError = true;
				userMessage = "Please fill in all required fields.";
				shouldLog = false;
				break;
				
			case ClerkErrorCode.FormParameterInvalid:
			case ClerkErrorCode.RequestBodyInvalid:
				isValidationError = true;
				userMessage = "Please check your input and try again.";
				shouldLog = false;
				break;
				
			case ClerkErrorCode.AuthorizationInvalid:
			case ClerkErrorCode.AuthorizationMissing:
				userMessage = "Authentication error. Please try again.";
				break;
				
			default:
				// Check for validation errors by prefix
				if (code && (code.startsWith('form_param') || code.includes('_invalid'))) {
					isValidationError = true;
					shouldLog = false;
				}
				// Don't override status-based message if we have one
				if (!context.httpStatus || context.httpStatus < 400) {
					userMessage = message;
				}
		}
	}
	
	// Only log unexpected errors to Sentry
	if (shouldLog) {
		const sentryError = new Error(`[Clerk:${context.action}] ${message}`);
		sentryError.cause = errorData;
		
		captureException(sentryError, {
			tags: {
				action: context.action,
				component: context.component ?? 'clerk-api',
				error_code: code,
				error_type: isRateLimit ? 'rate_limit' : 
					isAlreadyExists ? 'duplicate' : 
					isValidationError ? 'validation' : 
					isUserLocked ? 'locked' : 'api_error',
				http_status: context.httpStatus?.toString(),
				clerk_trace_id: clerkTraceId,
			},
			extra: {
				// Don't log sensitive data
				action: context.action,
				component: context.component,
				httpStatus: context.httpStatus,
				errorMessage: message,
				userMessage,
				code,
				// Only log non-sensitive error data
				errorType: typeof errorData,
				hasErrors: !!(errorData as Record<string, unknown>).errors,
				errorCount: Array.isArray((errorData as Record<string, unknown>).errors) ? ((errorData as Record<string, unknown>).errors as unknown[]).length : undefined,
			},
			level: isRateLimit || isValidationError ? 'warning' : 'error',
			fingerprint: ['clerk-error', context.action, code ?? 'unknown'],
		});
	}
	
	return {
		message,
		userMessage,
		code,
		isRateLimit,
		isAlreadyExists,
		isValidationError,
		isUserLocked,
		retryAfterSeconds,
		clerkTraceId,
		shouldLog,
	};
}

