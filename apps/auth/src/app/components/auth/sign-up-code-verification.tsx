"use client";

import * as React from "react";
import { useSignUp } from "@clerk/nextjs";
import { toast } from "sonner";
import { useLogger } from "@vendor/observability/client-log";
import { handleError as handleErrorWithSentry } from "@repo/ui/lib/utils";
import { useCodeVerification } from "~/app/hooks/use-code-verification";
import { CodeVerificationUI } from "./shared/code-verification-ui";
import { getErrorMessage } from "~/app/lib/clerk/error-handling";

interface SignUpCodeVerificationProps {
	email: string;
	onReset: () => void;
	onError: (_error: string) => void;
}

export function SignUpCodeVerification({
	email,
	onReset,
	onError: _onError,
}: SignUpCodeVerificationProps) {
	const { signUp, setActive } = useSignUp();
	const log = useLogger();
	const {
		code,
		setCode,
		isVerifying,
		setIsVerifying,
		inlineError,
		isRedirecting,
		setIsRedirecting,
		isResending,
		setIsResending,
		setCustomError,
	} = useCodeVerification();

	async function handleComplete(value: string) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!signUp || !setActive) return;
		
		setIsVerifying(true);
		setCustomError("");

		try {
			// Attempt to verify the code
			const result = await signUp.attemptEmailAddressVerification({
				code: value,
			});

			if (result.status === "complete") {
				// Sign-up successful, set the active session
				setIsRedirecting(true);
				await setActive({ session: result.createdSessionId });
			} else {
				// Log unexpected status for debugging
				log.warn('[SignUpCodeVerification] Unexpected sign-up status', {
					status: result.status,
					email,
					timestamp: new Date().toISOString(),
					signUpData: result,
				});
				
				// Capture to Sentry with context in error message
				const unexpectedError = new Error(
					`[SignUp] Unexpected status: ${result.status} | Email: ${email}`
				);
				handleErrorWithSentry(unexpectedError, false);
				
				setCustomError("Unexpected response. Please try again.");
				setIsVerifying(false);
			}
		} catch (err) {
			// Log the error with context
			log.error("[SignUpCodeVerification] Verification failed", { 
				email,
				error: err 
			});
			
			// Capture to Sentry once (parseError in handleErrorWithSentry does this)
			handleErrorWithSentry(err, false);
			
			// Check for incorrect code (Clerk-specific error message)
			const clerkErrorMessage = getErrorMessage(err);
			if (clerkErrorMessage.toLowerCase().includes('incorrect') || clerkErrorMessage.toLowerCase().includes('invalid')) {
				setCustomError("The entered code is incorrect. Please try again and check for typos.");
			} else {
				// Use the Clerk error message
				setCustomError(clerkErrorMessage);
			}
			
			// Don't clear the code - let user see what they typed
			setIsVerifying(false);
		}
	}

	async function handleResendCode() {
		if (!signUp) return;

		setIsResending(true);
		setCustomError("");
		try {
			// Resend the verification code
			await signUp.prepareEmailAddressVerification({
				strategy: 'email_code',
			});
			
			// Show success message to user
			toast.success("Verification code sent to your email");
			setCode("");
		} catch (err) {
			// Log the error with context
			log.error("[SignUpCodeVerification] Resend failed", { 
				email,
				error: err 
			});
			
			// Capture to Sentry once
			handleErrorWithSentry(err, false);
			
			// Use Clerk error message
			const clerkErrorMessage = getErrorMessage(err);
			setCustomError(clerkErrorMessage);
		} finally {
			setIsResending(false);
		}
	}

	// Auto-submit when code is complete (but not if there's an error showing)
	React.useEffect(() => {
		if (code.length === 6 && !inlineError) {
			// Handle the promise to avoid unhandled rejection
			handleComplete(code).catch(() => {
				// Error is already handled in handleComplete
			});
		}
	}, [code, inlineError]);

	return (
		<CodeVerificationUI
			email={email}
			code={code}
			onCodeChange={setCode}
			isVerifying={isVerifying}
			isRedirecting={isRedirecting}
			isResending={isResending}
			inlineError={inlineError}
			onResend={handleResendCode}
			onReset={onReset}
		/>
	);
}