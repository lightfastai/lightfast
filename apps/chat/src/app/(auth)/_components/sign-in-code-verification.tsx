"use client";

import * as React from "react";
import { useSignIn } from "@clerk/nextjs";
import { toast } from "@repo/ui/components/ui/sonner";
import { useLogger } from "@vendor/observability/client-log";
import { useCodeVerification } from "~/hooks/use-code-verification";
import { CodeVerificationUI } from "./shared/code-verification-ui";
import { handleClerkError, handleUnexpectedStatus } from "~/app/lib/clerk/error-handler";

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
				// Log unexpected status for debugging
				log.warn("[SignInCodeVerification] Unexpected sign-in status", {
					status: result.status,
					email,
					timestamp: new Date().toISOString(),
					signInData: result,
				});

				// Handle unexpected status with proper context
				handleUnexpectedStatus(result.status ?? 'unknown', {
					component: 'SignInCodeVerification',
					action: 'verify_code',
					email,
					result: result,
				});

				setCustomError("Unexpected response. Please try again.");
				setIsVerifying(false);
			}
		} catch (err) {
			// Log the error
			log.error("[SignInCodeVerification] Verification failed", { 
				email,
				error: err
			});
			
			// Handle the Clerk error with full context
			const errorResult = handleClerkError(err, {
				component: 'SignInCodeVerification',
				action: 'verify_code',
				email,
			});
			
			// Set the user-friendly error message
			setCustomError(errorResult.userMessage);
			
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
			// Log the error
			log.error("[SignInCodeVerification] Resend failed", { 
				email,
				error: err
			});
			
			// Handle the Clerk error with full context
			const errorResult = handleClerkError(err, {
				component: 'SignInCodeVerification',
				action: 'resend_code',
				email,
			});
			
			// Set the user-friendly error message
			setCustomError(errorResult.userMessage);
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

