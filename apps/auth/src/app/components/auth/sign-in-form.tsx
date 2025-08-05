"use client";
import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { EmailInput } from "./email-input";
import { CodeVerification } from "./code-verification";
import { OAuthSignIn } from "./oauth-sign-in";

export function SignInForm() {
	const [verificationStep, setVerificationStep] = React.useState<'email' | 'code'>('email');
	const [emailAddress, setEmailAddress] = React.useState('');
	const [error, setError] = React.useState('');

	function handleEmailSuccess(email: string) {
		setEmailAddress(email);
		setVerificationStep('code');
		setError('');
	}

	function handleReset() {
		setVerificationStep('email');
		setError('');
		setEmailAddress('');
	}

	function handleError(errorMessage: string) {
		setError(errorMessage);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="text-center">
				<h1 className="text-lg font-bold text-foreground">
					Sign in to Lightfast
				</h1>
			</div>

			<div className="space-y-4 mt-8">
				{error && (
					<div className="space-y-4">
						<div className="rounded-md bg-destructive/15 p-3">
							<p className="text-sm text-destructive">{error}</p>
						</div>
						<Button onClick={handleReset} variant="outline" className="w-full">
							Try again
						</Button>
					</div>
				)}

				{!error && verificationStep === 'email' && (
					<>
						{/* Email Sign In */}
						<EmailInput 
							onSuccess={handleEmailSuccess}
							onError={handleError}
						/>

						{/* Divider */}
						<div className="relative my-4">
							<div className="absolute inset-0 flex items-center">
								<span className="w-full border-t border-border/50" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">
									Or
								</span>
							</div>
						</div>

						{/* OAuth Sign In */}
						<OAuthSignIn />
					</>
				)}

				{!error && verificationStep === 'code' && (
					<CodeVerification 
						email={emailAddress}
						onReset={handleReset}
						onError={handleError}
					/>
				)}
			</div>

			{/* Sign Up Link - only show on email step */}
			{verificationStep === 'email' && (
				<div className="text-center text-sm">
					<span className="text-muted-foreground">
						Don't have an account?{" "}
					</span>
					<a
						href="/sign-up"
						className="text-primary hover:text-primary/80 underline"
					>
						Sign up
					</a>
				</div>
			)}
		</div>
	);
}