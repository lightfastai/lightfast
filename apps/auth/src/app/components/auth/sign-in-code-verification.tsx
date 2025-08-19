"use client";

import * as React from "react";
import { useSignIn } from "@clerk/nextjs";
import { toast } from "sonner";
import { useLogger } from "@vendor/observability/client-log";
import { handleError as handleErrorWithSentry } from "@repo/ui/lib/utils";
import { useCodeVerification } from "~/app/hooks/use-code-verification";
import { CodeVerificationUI } from "./shared/code-verification-ui";
import {
	getErrorMessage,
	isAccountLockedError,
	formatLockoutTime,
} from "~/app/lib/clerk/error-handling";

interface SignInCodeVerificationProps {
	email: string;
	onReset: () => void;
	onError: (_error: string) => void;
}

export function SignInCodeVerification({
	email,
	onReset,
	onError: _onError,
}: SignInCodeVerificationProps) {
	const { signIn, setActive } = useSignIn();
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
		if (!signIn || !setActive) return;

		setIsVerifying(true);
		setCustomError("");

		try {
			// Attempt to verify the code
			const result = await signIn.attemptFirstFactor({
				strategy: "email_code",
				code: value,
			});

			if (result.status === "complete") {
				// Sign-in successful, set the active session
				setIsRedirecting(true);
				await setActive({ session: result.createdSessionId });
			} else {
				// Create error with full context for Sentry
				const errorContext = {
					component: "SignInCodeVerification",
					status: result.status,
					email,
					timestamp: new Date().toISOString(),
					signInData: result,
				};

				const unexpectedError = new Error(
					`Unexpected sign-in status: ${result.status} | Context: ${JSON.stringify(errorContext)}`,
				);

				// Log for debugging
				log.warn("[SignInCodeVerification] Unexpected sign-in status", errorContext);

				// Capture to Sentry without showing toast (we show inline error instead)
				handleErrorWithSentry(unexpectedError, false);

				setCustomError("Unexpected response. Please try again.");
				setIsVerifying(false);
			}
		} catch (err) {
			// Log and capture to Sentry (once)
			handleErrorWithSentry(err, false);
			
			// Check for account lockout (Clerk-specific)
			const lockoutInfo = isAccountLockedError(err);
			if (lockoutInfo.locked && lockoutInfo.expiresInSeconds) {
				setCustomError(`Account locked. Please try again in ${formatLockoutTime(lockoutInfo.expiresInSeconds)}.`);
			} else {
				// Check for incorrect code (Clerk-specific error message)
				const clerkErrorMessage = getErrorMessage(err);
				if (clerkErrorMessage.toLowerCase().includes('incorrect') || clerkErrorMessage.toLowerCase().includes('invalid')) {
					setCustomError("The entered code is incorrect. Please try again and check for typos.");
				} else {
					// Use the Clerk error message
					setCustomError(clerkErrorMessage);
				}
			}
			
			// Don't clear the code - let user see what they typed
			setIsVerifying(false);
		}
	}

	async function handleResendCode() {
		if (!signIn) return;

		setIsResending(true);
		setCustomError("");
		try {
			// Resend the verification code
			const emailFactor = signIn.supportedFirstFactors?.find(
				(factor) => factor.strategy === "email_code",
			);

			if (!emailFactor?.emailAddressId) {
				setCustomError("Unable to resend code. Please try again.");
				return;
			}

			await signIn.prepareFirstFactor({
				strategy: "email_code",
				emailAddressId: emailFactor.emailAddressId,
			});

			// Show success message to user
			toast.success("Verification code sent to your email");
			setCode("");
		} catch (err) {
			// Log and capture to Sentry (once)
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

