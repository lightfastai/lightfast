"use client";

import * as React from "react";
import { useSignIn } from "@clerk/nextjs";
import { toast } from "sonner";
import { handleError as handleErrorWithSentry } from "@repo/ui/lib/utils";
import { useCodeVerification } from "~/app/hooks/use-code-verification";
import { CodeVerificationUI } from "./shared/code-verification-ui";

interface CodeVerificationProps {
	email: string;
	onReset: () => void;
	onError: (_error: string) => void;
}

export function CodeVerification({
	email,
	onReset,
	onError: _onError,
}: CodeVerificationProps) {
	const { signIn, setActive } = useSignIn();
	const {
		code,
		setCode,
		isVerifying,
		setIsVerifying,
		inlineError,
		setInlineError,
		isRedirecting,
		setIsRedirecting,
		isResending,
		setIsResending,
		handleError,
		log,
	} = useCodeVerification({ email });

	async function handleComplete(value: string) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!signIn || !setActive) return;

		setIsVerifying(true);
		setInlineError(null);

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
				log.info("[CodeVerification] Authentication success", {
					email,
					sessionId: result.createdSessionId,
					timestamp: new Date().toISOString(),
				});
			} else {
				// Create error with full context for Sentry
				const errorContext = {
					component: "CodeVerification",
					status: result.status,
					email,
					timestamp: new Date().toISOString(),
					signInData: result,
				};

				const unexpectedError = new Error(
					`Unexpected sign-in status: ${result.status} | Context: ${JSON.stringify(errorContext)}`,
				);

				// Log for debugging
				log.warn("[CodeVerification] Unexpected sign-in status", errorContext);

				// Capture to Sentry without showing toast (we show inline error instead)
				handleErrorWithSentry(unexpectedError, false);

				setInlineError("Unexpected response. Please try again.");
				setIsVerifying(false);
			}
		} catch (err) {
			handleError(err, "CodeVerification");
			// Don't clear the code - let user see what they typed
			setIsVerifying(false);
		}
	}

	async function handleResendCode() {
		if (!signIn) return;

		setIsResending(true);
		setInlineError(null);
		try {
			// Resend the verification code
			const emailFactor = signIn.supportedFirstFactors?.find(
				(factor) => factor.strategy === "email_code",
			);

			if (!emailFactor?.emailAddressId) {
				setInlineError("Unable to resend code. Please try again.");
				return;
			}

			await signIn.prepareFirstFactor({
				strategy: "email_code",
				emailAddressId: emailFactor.emailAddressId,
			});

			log.info("[CodeVerification.handleResendCode] Code resent successfully", {
				email,
				timestamp: new Date().toISOString(),
			});

			// Show success message to user
			toast.success("Verification code sent to your email");
			setCode("");
		} catch (err) {
			handleError(err, "CodeVerification.handleResendCode");
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

