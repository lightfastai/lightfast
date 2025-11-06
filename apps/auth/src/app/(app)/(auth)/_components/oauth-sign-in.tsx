"use client";

import * as React from "react";
import type { OAuthStrategy } from "@clerk/types";
import { useSignIn } from "@clerk/nextjs";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { Icons } from "@repo/ui/components/icons";
import { handleClerkError } from "~/app/lib/clerk/error-handler";
import { useLogger } from "@vendor/observability/client-log";
import { consoleUrl } from "~/lib/related-projects";

export function OAuthSignIn() {
	const { signIn, isLoaded } = useSignIn();
	const [loading, setLoading] = React.useState<OAuthStrategy | null>(null);
	const log = useLogger();

	const signInWith = async (strategy: OAuthStrategy) => {
		if (!signIn) return;

		try {
			setLoading(strategy);
			await signIn.authenticateWithRedirect({
				strategy,
				redirectUrl: "/sign-in/sso-callback",
				redirectUrlComplete: consoleUrl,
			});
		} catch (err) {
			// Log the error
			log.error("[OAuthSignIn] OAuth authentication failed", {
				strategy,
				error: err,
			});

			// Handle the error with proper context
			const errorResult = handleClerkError(err, {
				component: "OAuthSignIn",
				action: "oauth_redirect",
				strategy,
			});

			// Show user-friendly error message
			// For OAuth, we show a toast since redirect failed
			toast.error(errorResult.userMessage);

			setLoading(null);
		}
	};

	return (
		<div className="space-y-3">
			<Button
				variant="outline"
				className="w-full h-12"
				onClick={() => signInWith("oauth_google")}
				disabled={!isLoaded || loading !== null}
			>
				{loading === "oauth_google" ? (
					<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
				) : (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 17 16"
						className="w-4 h-4 mr-2"
						aria-hidden
					>
						<path
							fill="currentColor"
							d="M8.82 7.28v2.187h5.227c-.16 1.226-.57 2.124-1.192 2.755-.764.765-1.955 1.6-4.035 1.6-3.218 0-5.733-2.595-5.733-5.813 0-3.218 2.515-5.814 5.733-5.814 1.733 0 3.005.685 3.938 1.565l1.538-1.538C12.998.96 11.256 0 8.82 0 4.41 0 .705 3.591.705 8s3.706 8 8.115 8c2.382 0 4.178-.782 5.582-2.24 1.44-1.44 1.893-3.475 1.893-5.111 0-.507-.035-.978-.115-1.369H8.82Z"
						/>
					</svg>
				)}
				Continue with Google
			</Button>

			<Button
				variant="outline"
				className="w-full h-12"
				onClick={() => signInWith("oauth_github")}
				disabled={!isLoaded || loading !== null}
			>
				{loading === "oauth_github" ? (
					<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
				) : (
					<Icons.gitHub className="mr-2 h-4 w-4" />
				)}
				Continue with GitHub
			</Button>
		</div>
	);
}
