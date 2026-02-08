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

interface OAuthSignInProps {
	onError?: (error: string, isSignUpRestricted?: boolean) => void;
}

export function OAuthSignIn({ onError }: OAuthSignInProps = {}) {
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
				redirectUrlComplete: `${consoleUrl}/account/teams/new`,
			});
		} catch (err) {
			log.error("[OAuthSignIn] OAuth authentication failed", {
				strategy,
				error: err,
			});

			const errorResult = handleClerkError(err, {
				component: "OAuthSignIn",
				action: "oauth_redirect",
				strategy,
			});

			// For waitlist errors, pass to parent form for inline display
			// For other errors, show toast
			if (errorResult.isSignUpRestricted && onError) {
				onError(errorResult.userMessage, errorResult.isSignUpRestricted);
			} else {
				toast.error(errorResult.userMessage);
			}
			setLoading(null);
		}
	};

	return (
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
	);
}
