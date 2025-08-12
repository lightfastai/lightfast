"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@sentry/nextjs";
import { isNotFound } from "~/lib/trpc-errors";
import { Button } from "@repo/ui/components/ui/button";
import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import { LightfastErrorPage, ErrorCode } from "@repo/ui/components/lightfast-error-page";

interface SessionErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function SessionError({ error, reset }: SessionErrorProps) {
	useEffect(() => {
		// Only capture unexpected errors to Sentry
		// NOT_FOUND is expected when users try to access sessions they don't own
		const isNotFoundError = isNotFound(error);
		
		if (!isNotFoundError) {
			// Capture unexpected errors for monitoring
			captureException(error);
		}
		
		// Always log for local debugging
		console.error("Session error:", error);
	}, [error]);

	// Handle TRPC NOT_FOUND errors (unauthorized access or non-existent session)
	if (isNotFound(error)) {
		return (
			<LightfastCustomGridBackground.Root
				marginVertical="25vh"
				marginHorizontal="25vw"
				marginVerticalMobile="25vh"
				marginHorizontalMobile="10vw"
			>
				<LightfastCustomGridBackground.Container>
					<LightfastErrorPage
						code={ErrorCode.NotFound}
						description="This chat session doesn't exist or you don't have access to it."
					>
						<Button asChild>
							<Link href="/new">Start New Chat</Link>
						</Button>
					</LightfastErrorPage>
				</LightfastCustomGridBackground.Container>
			</LightfastCustomGridBackground.Root>
		);
	}

	// Handle other errors
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
					description="Something went wrong loading this chat session."
					errorId={error.digest}
				>
					<Button onClick={() => reset()}>Try again</Button>
					<Button variant="outline" asChild>
						<Link href="/new">Start New Chat</Link>
					</Button>
				</LightfastErrorPage>
			</LightfastCustomGridBackground.Container>
		</LightfastCustomGridBackground.Root>
	);
}