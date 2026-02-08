"use client";
import * as React from "react";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { SignUpEmailInput } from "./sign-up-email-input";
import { SignUpPassword } from "./sign-up-password";
import { SignUpCodeVerification } from "./sign-up-code-verification";
import { OAuthSignUp } from "./oauth-sign-up";
import { siteConfig } from "@repo/site-config";
import { env } from "~/env";

export function SignUpForm() {
	const searchParams = useSearchParams();
	const invitationTicket = searchParams.get("__clerk_ticket");
	const { signUp } = useSignUp();

	const [verificationStep, setVerificationStep] = React.useState<
		"email" | "code" | "password"
	>("email");
	const [emailAddress, setEmailAddress] = React.useState("");
	const [error, setError] = React.useState("");
	const [isWaitlistRestricted, setIsWaitlistRestricted] =
		React.useState(false);

	// Only show password sign-up in development and preview environments
	const showPasswordSignUp = env.NEXT_PUBLIC_VERCEL_ENV !== "production";

	// Check for waitlist error after OAuth redirect (e.g. SSO callback failure)
	React.useEffect(() => {
		const verificationError =
			signUp?.verifications.emailAddress.error;
		if (verificationError?.code === "sign_up_restricted_waitlist") {
			setError(
				verificationError.longMessage ??
					"Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
			);
			setIsWaitlistRestricted(true);
		}
	}, [signUp]);

	function handleEmailSuccess(email: string) {
		setEmailAddress(email);
		setVerificationStep("code");
		setError("");
	}

	function handleReset() {
		setVerificationStep("email");
		setError("");
		setEmailAddress("");
		setIsWaitlistRestricted(false);
	}

	function handleError(errorMessage: string, isSignUpRestricted = false) {
		setError(errorMessage);
		setIsWaitlistRestricted(isSignUpRestricted);
	}

	return (
		<div className="w-full max-w-md space-y-8">
			{/* Header - only show on email and password steps */}
			{(verificationStep === "email" || verificationStep === "password") && (
				<div className="text-center">
					<h1 className="text-3xl font-semibold text-foreground">
						Sign up for Lightfast
					</h1>
				</div>
			)}

			{/* Invitation info - show when ticket is present */}
			{invitationTicket && verificationStep === "email" && (
				<div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
					<p className="text-sm text-blue-800">
						You've been invited to join Lightfast. Complete sign-up below.
					</p>
				</div>
			)}

			<div className="space-y-4">
				{error && !isWaitlistRestricted && (
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

				{error && isWaitlistRestricted && (
					<div className="space-y-4">
						<div className="rounded-lg bg-destructive/30 border border-border p-3">
							<p className="text-sm text-foreground">{error}</p>
						</div>
						<Button asChild className="w-full h-12">
							<MicrofrontendLink href="/early-access">
								Join the Waitlist
							</MicrofrontendLink>
						</Button>
						<Button
							onClick={handleReset}
							variant="outline"
							className="w-full h-12"
						>
							Back to Sign Up
						</Button>
					</div>
				)}

				{!error && verificationStep === "email" && (
					<>
						{/* Email Sign Up */}
						<SignUpEmailInput
							onSuccess={handleEmailSuccess}
							onError={handleError}
							invitationTicket={invitationTicket}
						/>

						{/* Legal compliance text */}
						<p className="text-xs text-center text-muted-foreground">
							By joining, you agree to our{" "}
							<MicrofrontendLink
								href={siteConfig.links.terms.href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground hover:text-foreground/80 underline"
							>
								Terms of Service
							</MicrofrontendLink>{" "}
							and{" "}
							<MicrofrontendLink
								href={siteConfig.links.privacy.href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground hover:text-foreground/80 underline"
							>
								Privacy Policy
							</MicrofrontendLink>
						</p>

						{showPasswordSignUp && (
							<>
								{/* Separator */}
								<div className="relative">
									<div className="absolute inset-0 flex items-center">
										<Separator className="w-full" />
									</div>
									<div className="relative flex justify-center text-xs uppercase">
										<span className="bg-background px-2 text-muted-foreground">
											Or
										</span>
									</div>
								</div>

								{/* Password Sign Up Option */}
								<Button
									variant="outline"
									onClick={() => setVerificationStep("password")}
									className="w-full h-12"
								>
									Sign up with Password
								</Button>
							</>
						)}

						{/* Separator */}
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<Separator className="w-full" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">
									Or
								</span>
							</div>
						</div>

						{/* OAuth Sign Up */}
						<OAuthSignUp onError={handleError} invitationTicket={invitationTicket} />
					</>
				)}

				{!error && verificationStep === "password" && (
					<>
						<SignUpPassword
							onSuccess={handleEmailSuccess}
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
					<SignUpCodeVerification
						email={emailAddress}
						onReset={handleReset}
						onError={handleError}
					/>
				)}
			</div>

			{/* Sign In Link - only show on email step */}
			{verificationStep === "email" && (
				<div className="text-center text-sm">
					<span className="text-muted-foreground">
						Already have an account?{" "}
					</span>
					<Button
						asChild
						variant="link-blue"
						className="inline-flex h-auto p-0 rounded-none text-sm"
					>
						<NextLink href="/sign-in" prefetch>
							Log In
						</NextLink>
					</Button>
				</div>
			)}
		</div>
	);
}
