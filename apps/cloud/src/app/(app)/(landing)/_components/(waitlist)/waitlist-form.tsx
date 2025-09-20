"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Separator } from "@repo/ui/components/ui/separator";
import { joinClerkWaitlistAction } from "./_actions/clerk-waitlist";
import Link from "next/link";
import { getAppUrl } from "@repo/url-utils";
import { ConfettiWrapper } from "./confetti-wrapper";
import { captureException } from "@sentry/nextjs";

function SubmitButton() {
	const { pending } = useFormStatus();

	return (
		<Button type="submit" disabled={pending} className="w-full h-12">
			{pending ? "Joining..." : "Join the waitlist"}
		</Button>
	);
}

export function WaitlistForm() {
	const [state, formAction] = useActionState(joinClerkWaitlistAction, { status: "idle" });
	const wwwUrl = getAppUrl("www");
	const authUrl = getAppUrl("auth");

	// Track client-side errors
	useEffect(() => {
		if (state.status === "error") {
			// Report to Sentry when an error occurs on the client
			captureException(new Error(`Waitlist form error: ${state.error}`), {
				tags: {
					component: "waitlist-form",
					error_type: state.isRateLimit ? "rate_limit" : "form_error",
				},
				extra: {
					errorMessage: state.error,
					isRateLimit: state.isRateLimit,
					timestamp: new Date().toISOString(),
				},
				level: state.isRateLimit ? "warning" : "error",
			});
		}
	}, [state]);

	if (state.status === "success") {
		return (
			<>
				<ConfettiWrapper />
				<div className="w-full text-center space-y-2">
					<p className="text-sm font-medium">
						You've joined the Lightfast Cloud waitlist!
					</p>
					<p className="text-xs text-muted-foreground">
						We'll send you an invite when we're ready. Check your email for
						updates.
					</p>
				</div>
			</>
		);
	}

	return (
		<div className="w-full space-y-4">
			<form action={formAction} className="w-full flex flex-col gap-3">
				<Input
					type="email"
					name="email"
					placeholder="Email Address"
					required
					className="h-12 bg-background dark:bg-background"
					aria-describedby="email-error"
					aria-invalid={state.status === "validation_error" && !!state.fieldErrors.email}
				/>
				{state.status === "validation_error" && state.fieldErrors.email && (
					<p id="email-error" className="text-xs text-destructive">
						{state.fieldErrors.email[0]}
					</p>
				)}
				{state.status === "error" && (
					<div className="space-y-1">
						<p className={`text-xs ${state.isRateLimit ? "text-yellow-600 dark:text-yellow-500" : "text-destructive"}`}>
							{state.error}
						</p>
						{state.isRateLimit && (
							<p className="text-xs text-muted-foreground">
								Please wait a moment before trying again.
							</p>
						)}
					</div>
				)}
				<SubmitButton />
			</form>

			<div className="space-y-4">
				{/* Separator */}
				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<Separator className="w-full" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-background px-2 text-muted-foreground">Or</span>
					</div>
				</div>
				
				{/* Sign In Button */}
				<Link 
					href={`${authUrl}/sign-in`}
					className="inline-flex items-center justify-center w-full h-12 px-4 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input bg-background hover:bg-accent hover:text-accent-foreground"
				>
					Sign in with developer account
				</Link>
				
				<div className="text-xs text-muted-foreground text-center">
					By continuing, you agree to Lightfast's{" "}
					<Link 
						href={`${wwwUrl}/legal/terms`} 
						className="text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 underline transition-colors"
					>
						Terms of Service
					</Link>{" "}
					and acknowledge our{" "}
					<Link 
						href={`${wwwUrl}/legal/privacy`} 
						className="text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 underline transition-colors"
					>
						Privacy Policy
					</Link>
					.
				</div>
			</div>
		</div>
	);
}
