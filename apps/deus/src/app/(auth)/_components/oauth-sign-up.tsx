"use client";

import * as React from "react";
import type { OAuthStrategy } from "@clerk/types";
import { useSignUp } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";

export function OAuthSignUp() {
	const { signUp, isLoaded } = useSignUp();
	const [loading, setLoading] = React.useState<OAuthStrategy | null>(null);

	const signUpWith = async (strategy: OAuthStrategy) => {
		if (!signUp) return;

		try {
			setLoading(strategy);
			await signUp.authenticateWithRedirect({
				strategy,
				redirectUrl: "/sign-up/sso-callback",
				redirectUrlComplete: "/onboarding",
				// Let Clerk handle redirect based on session state (pending/active)
				// Pending users will be redirected to taskUrls, active users to signUpFallbackRedirectUrl
			});
		} catch {
			toast.error("Failed to sign up. Please try again.");
			setLoading(null);
		}
	};

	return (
		<div className="space-y-3">
			<Button
				variant="outline"
				className="w-full h-12"
				onClick={() => signUpWith("oauth_github")}
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
