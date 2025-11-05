"use client";
import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { OAuthSignUp } from "./oauth-sign-up";
import { SignUpPassword } from "./sign-up-password";
import Link from "next/link";
import { siteConfig } from "@repo/site-config";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";

export function SignUpForm() {
	const [error, setError] = React.useState<string | null>(null);
	const [pendingVerification, setPendingVerification] = React.useState(false);
	const [email, setEmail] = React.useState("");

	const handlePasswordSuccess = (userEmail: string) => {
		setEmail(userEmail);
		setPendingVerification(true);
	};

	const handlePasswordError = (errorMessage: string) => {
		setError(errorMessage);
	};

	// For now, just show a message that verification is needed
	// TODO: Implement proper verification flow with code input
	if (pendingVerification) {
		return (
			<div className="w-full space-y-8">
				<div className="text-center">
					<h1 className="text-3xl font-semibold text-foreground">
						Check your email
					</h1>
					<p className="mt-4 text-muted-foreground">
						We've sent a verification code to <strong>{email}</strong>
					</p>
					<p className="mt-2 text-sm text-muted-foreground">
						Please check your email and click the verification link to complete sign-up.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full space-y-8">
			{/* Header */}
			<div className="text-center">
				<h1 className="text-3xl font-semibold text-foreground">
					Sign up for Deus
				</h1>
			</div>

			<div className="space-y-4">
				{/* Error Message */}
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Password Sign Up */}
				<SignUpPassword
					onSuccess={handlePasswordSuccess}
					onError={handlePasswordError}
				/>

				{/* Divider */}
				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<span className="w-full border-t" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-background px-2 text-muted-foreground">
							Or continue with
						</span>
					</div>
				</div>

				{/* OAuth Sign Up */}
				<OAuthSignUp />

				{/* Legal compliance text */}
				<p className="text-xs text-center text-muted-foreground">
					By joining, you agree to our{" "}
					<Link
						href={siteConfig.links.terms.href}
						target="_blank"
						rel="noopener noreferrer"
						className="text-foreground hover:text-foreground/80 underline"
					>
						Terms of Service
					</Link>{" "}
					and{" "}
					<Link
						href={siteConfig.links.privacy.href}
						target="_blank"
						rel="noopener noreferrer"
						className="text-foreground hover:text-foreground/80 underline"
					>
						Privacy Policy
					</Link>
				</p>
			</div>

			{/* Sign In Link */}
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
		</div>
	);
}
