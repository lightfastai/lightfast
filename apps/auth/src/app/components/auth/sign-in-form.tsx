"use client";
import * as React from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { EmailInput } from "./email-input";
import { SignInCodeVerification } from "./sign-in-code-verification";
import { OAuthSignIn } from "./oauth-sign-in";

interface SignInFormProps {
	verificationStep?: "email" | "code";
	onVerificationStepChange?: (step: "email" | "code") => void;
}

export function SignInForm({
	verificationStep: controlledStep,
	onVerificationStepChange,
}: SignInFormProps = {}) {
	const [internalStep, setInternalStep] = React.useState<"email" | "code">(
		"email",
	);
	const verificationStep = controlledStep ?? internalStep;
	const setVerificationStep = onVerificationStepChange ?? setInternalStep;

	const [emailAddress, setEmailAddress] = React.useState("");
	const [error, setError] = React.useState("");

	function handleEmailSuccess(email: string) {
		setEmailAddress(email);
		setVerificationStep("code");
		setError("");
	}

	function handleReset() {
		setVerificationStep("email");
		setError("");
		setEmailAddress("");
	}

	function handleError(errorMessage: string) {
		setError(errorMessage);
	}

	return (
		<div className="w-full space-y-8">
			{/* Header - only show on email step */}
			{verificationStep === "email" && (
				<div className="text-center">
					<h1 className="text-3xl font-semibold text-foreground">
						Log in to Lightfast
					</h1>
				</div>
			)}

			<div className="space-y-4">
				{error && (
					<div className="space-y-4">
						<div className="rounded-lg bg-red-50 border border-red-200 p-3">
							<p className="text-sm text-red-800">{error}</p>
						</div>
						<Button onClick={handleReset} variant="outline" className="w-full h-12">
							Try again
						</Button>
					</div>
				)}

				{!error && verificationStep === "email" && (
					<>
						{/* Email Sign In */}
						<EmailInput onSuccess={handleEmailSuccess} onError={handleError} />

						{/* Separator */}
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<Separator className="w-full" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">Or</span>
							</div>
						</div>

						{/* OAuth Sign In */}
						<OAuthSignIn />
					</>
				)}

				{!error && verificationStep === "code" && (
					<SignInCodeVerification
						email={emailAddress}
						onReset={handleReset}
						onError={handleError}
					/>
				)}
			</div>

			{/* Sign Up Link - only show on email step */}
			{verificationStep === "email" && (
				<div className="text-center text-sm">
					<span className="text-muted-foreground">Don't have an account? </span>
					<Button
						asChild
						variant="link-blue"
						className="inline-flex h-auto p-0 rounded-none text-sm"
					>
						<Link href="/sign-up">Sign Up</Link>
					</Button>
				</div>
			)}
		</div>
	);
}

