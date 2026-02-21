"use client";
import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { SignUpEmailInput } from "./sign-up-email-input";
import { SignUpCodeVerification } from "./sign-up-code-verification";
import { SignUpPassword } from "./sign-up-password";
import { OAuthSignUp } from "./oauth-sign-up";
import Link from "next/link";
import { env } from "~/env";

export function SignUpForm() {
	const isDev = env.NEXT_PUBLIC_VERCEL_ENV === "development";
	const [verificationStep, setVerificationStep] = React.useState<
		"email" | "code" | "password"
	>("email");
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

	function handlePasswordSuccess(email: string) {
		setEmailAddress(email);
		setVerificationStep("code");
		setError("");
	}

	return (
		<div className="w-full space-y-8">
			{/* Header - only show on email and password steps */}
			{(verificationStep === "email" || verificationStep === "password") && (
				<div className="text-center">
					<h1 className="text-3xl font-semibold text-foreground">
						Sign up for Lightfast
					</h1>
				</div>
			)}

			<div className="space-y-4">
				{error && (
					<div className="space-y-4">
						<div className="rounded-lg bg-red-50 border border-red-200 p-3">
							<p className="text-sm text-red-800">{error}</p>
						</div>
						<Button
							onClick={handleReset}
							variant="outline"
							className="w-full h-12"
						>
							Try again
						</Button>
					</div>
				)}

				{!error && verificationStep === "email" && (
					<>
						{/* Email Sign Up */}
						<SignUpEmailInput
							onSuccess={handleEmailSuccess}
							onError={handleError}
						/>

						{/* Legal compliance text */}
						<p className="text-xs text-center text-muted-foreground">
							By joining, you agree to our{" "}
							<Link
								href={"https://lightfast.ai/legal/terms"}
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground hover:text-foreground/80 underline"
							>
								Terms of Service
							</Link>{" "}
							and{" "}
							<Link
								href={"https://lightfast.ai/legal/privacy"}
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground hover:text-foreground/80 underline"
							>
								Privacy Policy
							</Link>
						</p>

						{/* Separator */}
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<Separator className="w-full" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">Or</span>
							</div>
						</div>

						{/* Password Sign Up Option (dev only) */}
						{isDev && (
							<>
								<Button
									variant="outline"
									onClick={() => setVerificationStep("password")}
									className="w-full h-12"
								>
									Sign up with Password
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

						{/* OAuth Sign Up */}
						<OAuthSignUp />
					</>
				)}

				{!error && isDev && verificationStep === "password" && (
					<>
						<SignUpPassword
							onSuccess={handlePasswordSuccess}
							onError={handleError}
						/>
						
						{/* Legal compliance text for password step */}
						<p className="text-xs text-center text-muted-foreground">
							By joining, you agree to our{" "}
							<Link
								href={"https://lightfast.ai/legal/terms"}
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground hover:text-foreground/80 underline"
							>
								Terms of Service
							</Link>{" "}
							and{" "}
							<Link
								href={"https://lightfast.ai/legal/privacy"}
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground hover:text-foreground/80 underline"
							>
								Privacy Policy
							</Link>
						</p>
						
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
					<SignUpCodeVerification
						email={emailAddress}
						onReset={handleReset}
						onError={handleError}
					/>
				)}
			</div>

			{/* Sign In Link - only show on email and password steps */}
			{(verificationStep === "email" || verificationStep === "password") && (
				<div className="text-center text-sm">
					<span className="text-muted-foreground">Already have an account? </span>
					<Button
						asChild
						variant="link-blue"
						className="inline-flex h-auto p-0 rounded-none text-sm"
					>
						<Link href="/sign-in">Log In</Link>
					</Button>
				</div>
			)}
		</div>
	);
}
