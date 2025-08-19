import * as React from "react";
import { useLogger } from "@vendor/observability/client-log";
import { handleError as handleErrorWithSentry } from "@repo/ui/lib/utils";

interface UseCodeVerificationOptions {
	email: string;
}

/**
 * Generic hook for code verification UI state and error handling.
 * This hook is auth-provider agnostic and handles only UI concerns.
 */
export function useCodeVerification({ email }: UseCodeVerificationOptions) {
	const log = useLogger();
	const [code, setCode] = React.useState("");
	const [isVerifying, setIsVerifying] = React.useState(false);
	const [inlineError, setInlineError] = React.useState<string | null>(null);
	const [isRedirecting, setIsRedirecting] = React.useState(false);
	const [isResending, setIsResending] = React.useState(false);

	const handleCodeChange = React.useCallback((value: string) => {
		// Clear error when user modifies the code (typing or deleting)
		if (inlineError && value !== code) {
			setInlineError(null);
		}
		setCode(value);
	}, [code, inlineError]);

	/**
	 * Generic error handler that logs and captures to Sentry.
	 * Returns the error message for further processing.
	 */
	const handleError = React.useCallback((err: unknown, context: string): string => {
		// Extract error message
		let errorMessage = "An error occurred";
		if (err instanceof Error) {
			errorMessage = err.message;
		} else if (err && typeof err === "object" && "message" in err) {
			errorMessage = String((err as { message: unknown }).message);
		} else if (typeof err === "string") {
			errorMessage = err;
		} else if (typeof err === "number" || typeof err === "boolean") {
			errorMessage = String(err);
		}
		
		// Log the error
		log.error(`[${context}] Authentication error`, { 
			error: err, 
			email,
			timestamp: new Date().toISOString()
		});
		
		// Create error with context for Sentry
		const contextualError = new Error(
			`${context}: ${errorMessage} | Context: ${JSON.stringify({ 
				email,
				timestamp: new Date().toISOString()
			})}`
		);
		
		// Capture to Sentry without toast (we show inline error)
		handleErrorWithSentry(contextualError, false);
		
		return errorMessage;
	}, [log, email]);

	/**
	 * Set a custom error message (used by components for provider-specific errors)
	 */
	const setCustomError = React.useCallback((message: string) => {
		setInlineError(message);
	}, []);

	const resetError = React.useCallback(() => {
		setInlineError(null);
	}, []);

	return {
		// State
		code,
		isVerifying,
		inlineError,
		isRedirecting,
		isResending,
		
		// State setters
		setCode: handleCodeChange,
		setIsVerifying,
		setIsRedirecting,
		setIsResending,
		
		// Error handling
		handleError,
		setCustomError,
		resetError,
		
		// Utilities
		log,
	};
}