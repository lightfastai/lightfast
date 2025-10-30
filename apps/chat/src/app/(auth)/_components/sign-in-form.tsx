"use client";
import * as React from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { SignInEmailInput } from "./sign-in-email-input";
import { SignInCodeVerification } from "./sign-in-code-verification";
import { SignInPassword } from "./sign-in-password";
import { OAuthSignIn } from "./oauth-sign-in";
import { env } from "~/env";

interface SignInFormProps {
	verificationStep?: "email" | "code" | "password";
	onVerificationStepChange?: (step: "email" | "code" | "password") => void;
}

export function SignInForm({
	verificationStep: controlledStep,
	onVerificationStepChange,
}: SignInFormProps = {}) {
	const isDev = env.NEXT_PUBLIC_VERCEL_ENV === "development";
	const [internalStep, setInternalStep] = React.useState<"email" | "code" | "password">(
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

	function handlePasswordSuccess() {
		// Password sign-in is complete, redirect happens via Clerk
		setError("");
	}

	return (
		<div className="w-full space-y-8">
			{/* Header - only show on email and password steps */}
			{(verificationStep === "email" || verificationStep === "password") && (
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
						<SignInEmailInput onSuccess={handleEmailSuccess} onError={handleError} />

						{/* Separator */}
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<Separator className="w-full" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">Or</span>
							</div>
						</div>

						{/* Password Sign In Option (dev only) */}
						{isDev && (
							<>
								<Button
									variant="outline"
									onClick={() => setVerificationStep("password")}
									className="w-full h-12"
								>
									Sign in with Password
								</Button>

								{/* Separator */}
								<div className="relative">
									<div className="absolute inset-0 flex items-center">
										<Separator className="w-full" />
									</div>
									<div className="relative flex justify-center text-xs uppercase">
										<span className="bg-background px-2 text-muted-foreground">Or</span>
									</div>
								</div>
							</>
						)}

						{/* OAuth Sign In */}
						<OAuthSignIn />
					</>
				)}

				{!error && isDev && verificationStep === "password" && (
					<>
						<SignInPassword
							onSuccess={handlePasswordSuccess}
							onError={handleError}
						/>
						
						<Button
							variant="ghost"
							onClick={handleReset}
							className="w-full h-12 text-muted-foreground hover:text-foreground"
						>
							← Back to other options
						</Button>
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

			{/* Sign Up Link - only show on email and password steps */}
			{(verificationStep === "email" || verificationStep === "password") && (
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
