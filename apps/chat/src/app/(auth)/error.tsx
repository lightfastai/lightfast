"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@sentry/nextjs";
import { Button } from "@repo/ui/components/ui/button";
import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import {
	LightfastErrorPage,
	ErrorCode,
} from "@repo/ui/components/lightfast-error-page";

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
		<LightfastCustomGridBackground.Root
			marginVertical="25vh"
			marginHorizontal="25vw"
			marginVerticalMobile="25vh"
			marginHorizontalMobile="10vw"
		>
			<LightfastCustomGridBackground.Container>
				<LightfastErrorPage
					code={ErrorCode.InternalServerError}
					description="We encountered an issue with authentication. Please try again."
					errorId={error.digest}
				>
					<Button onClick={() => reset()}>Try again</Button>
					<Button variant="outline" asChild>
						<Link href="/sign-in">Back to Sign In</Link>
					</Button>
				</LightfastErrorPage>
			</LightfastCustomGridBackground.Container>
		</LightfastCustomGridBackground.Root>
	);
}

