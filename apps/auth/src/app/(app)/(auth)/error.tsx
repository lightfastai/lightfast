"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@sentry/nextjs";
import { Button } from "@repo/ui/components/ui/button";

interface AuthErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function AuthError({ error, reset }: AuthErrorProps) {
	useEffect(() => {
		// Capture all errors to Sentry for auth routes
		captureException(error, {
			tags: {
				location: "auth-routes",
			},
			extra: {
				errorDigest: error.digest,
			},
		});

		// Always log for local debugging
		console.error("Auth route error:", error);
	}, [error]);

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-md space-y-6 text-center">
				<div className="space-y-2">
					<h1 className="text-3xl font-semibold text-foreground">
						Authentication Error
					</h1>
					<p className="text-muted-foreground">
						We encountered an issue with authentication. Please try again.
					</p>
					{error.digest && (
						<p className="text-xs text-muted-foreground">
							Error ID: {error.digest}
						</p>
					)}
				</div>
				<div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
					<Button onClick={() => reset()}>Try again</Button>
					<Button variant="outline" asChild>
						<Link href="/sign-in">Back to Sign In</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}