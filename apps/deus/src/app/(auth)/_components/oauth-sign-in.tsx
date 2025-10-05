"use client";

import * as React from "react";
import type { OAuthStrategy } from "@clerk/types";
import { useSignIn } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";

export function OAuthSignIn() {
	const { signIn, isLoaded } = useSignIn();
	const [loading, setLoading] = React.useState<OAuthStrategy | null>(null);

	const signInWith = async (strategy: OAuthStrategy) => {
		if (!signIn) return;

		try {
			setLoading(strategy);
			await signIn.authenticateWithRedirect({
				strategy,
				redirectUrl: "/sign-in/sso-callback",
				redirectUrlComplete: "/",
			});
		} catch {
			toast.error("Failed to sign in. Please try again.");
			setLoading(null);
		}
	};

	return (
		<div className="space-y-3">
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
