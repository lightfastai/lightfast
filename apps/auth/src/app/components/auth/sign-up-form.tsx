"use client";
import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { SignUpEmailInput } from "./sign-up-email-input";
import { SignUpCodeVerification } from "./sign-up-code-verification";
import { OAuthSignUp } from "./oauth-sign-up";
import Link from "next/link";
import { siteConfig } from "@repo/lightfast-config";

export function SignUpForm() {
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
					Sign up for Lightfast
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
						{/* Email Sign Up */}
						<SignUpEmailInput 
							onSuccess={handleEmailSuccess}
							onError={handleError}
						/>

						{/* Legal compliance text */}
						<p className="text-xs text-center text-muted-foreground">
							By joining, you agree to our{" "}
							<Link
								href={siteConfig.links.terms.href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								Terms of Service
							</Link>{" "}
							and{" "}
							<Link
								href={siteConfig.links.privacy.href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								Privacy Policy
							</Link>
						</p>

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

						{/* OAuth Sign Up */}
						<OAuthSignUp />
					</>
				)}

				{!error && verificationStep === 'code' && (
					<SignUpCodeVerification 
						email={emailAddress}
						onReset={handleReset}
						onError={handleError}
					/>
				)}
			</div>

			{/* Sign In Link - only show on email step */}
			{verificationStep === 'email' && (
				<div className="text-center text-sm">
					<span className="text-muted-foreground">
						Already have an account?{" "}
					</span>
					<a
						href="/sign-in"
						className="text-primary hover:text-primary/80 underline"
					>
						Sign in
					</a>
				</div>
			)}
		</div>
	);
}