import * as React from "react";
import { useLogger } from "@vendor/observability/client-log";
import { handleError as handleErrorWithSentry } from "@repo/ui/lib/utils";
import {
	getErrorMessage,
	formatErrorForLogging,
	isAccountLockedError,
	formatLockoutTime,
} from "~/app/lib/clerk/error-handling";

interface UseCodeVerificationOptions {
	email: string;
	onSuccess?: () => void;
	onError?: (_error: string) => void;
}

export function useCodeVerification({
	email,
	onSuccess: _onSuccess,
	onError: _onError,
}: UseCodeVerificationOptions) {
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

	const handleError = React.useCallback((err: unknown, context: string) => {
		// Log the error with full context
		const errorContext = formatErrorForLogging(context, err);
		log.error(`[${context}] Authentication error`, errorContext);
		
		// Check for account lockout (primarily for sign-in)
		const lockoutInfo = isAccountLockedError(err);
		if (lockoutInfo.locked && lockoutInfo.expiresInSeconds) {
			const errorMsg = `Account locked. Please try again in ${formatLockoutTime(lockoutInfo.expiresInSeconds)}.`;
			
			// Create error with context for Sentry
			const lockoutError = new Error(
				`Account locked | Context: ${JSON.stringify({ 
					context, 
					email, 
					lockoutSeconds: lockoutInfo.expiresInSeconds,
					timestamp: new Date().toISOString()
				})}`
			);
			
			// Capture to Sentry without toast (we show inline error)
			handleErrorWithSentry(lockoutError, false);
			
			setInlineError(errorMsg);
			return errorMsg;
		}
		
		const errorMessage = getErrorMessage(err);
		if (errorMessage.toLowerCase().includes('incorrect') || errorMessage.toLowerCase().includes('invalid')) {
			const errorMsg = "The entered code is incorrect. Please try again and check for typos.";
			
			// Create error with context for Sentry
			const incorrectCodeError = new Error(
				`Incorrect verification code | Context: ${JSON.stringify({ 
					context, 
					email,
					originalError: errorMessage,
					timestamp: new Date().toISOString()
				})}`
			);
			
			// Capture to Sentry without toast (we show inline error)
			handleErrorWithSentry(incorrectCodeError, false);
			
			setInlineError(errorMsg);
			return errorMsg;
		}
		
		// For any other error, capture to Sentry with context
		const generalError = new Error(
			`Authentication error: ${errorMessage} | Context: ${JSON.stringify({ 
				context, 
				email,
				timestamp: new Date().toISOString(),
				errorDetails: errorContext
			})}`
		);
		
		// Capture to Sentry without toast (we show inline error)
		handleErrorWithSentry(generalError, false);
		
		setInlineError(errorMessage);
		return errorMessage;
	}, [log, email]);

	const resetError = React.useCallback(() => {
		setInlineError(null);
	}, []);

	return {
		code,
		setCode: handleCodeChange,
		isVerifying,
		setIsVerifying,
		inlineError,
		setInlineError,
		isRedirecting,
		setIsRedirecting,
		isResending,
		setIsResending,
		handleError,
		resetError,
		log,
	};
}