import * as React from "react";

/**
 * Generic hook for code verification UI state management.
 * This hook is auth-provider agnostic and handles only UI state.
 */
export function useCodeVerification() {
	const [code, setCode] = React.useState("");
	const [isVerifying, setIsVerifying] = React.useState(false);
	const [inlineError, setInlineError] = React.useState<string | null>(null);
	const [isRedirecting, setIsRedirecting] = React.useState(false);
	const [isResending, setIsResending] = React.useState(false);

	const handleCodeChange = React.useCallback(
		(value: string) => {
			// Clear error when user modifies the code (typing or deleting)
			if (inlineError && value !== code) {
				setInlineError(null);
			}
			setCode(value);
		},
		[inlineError, code],
	);

	const setCustomError = React.useCallback((message: string | null) => {
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
		setCustomError,
		resetError,
	};
}