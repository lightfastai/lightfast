"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@sentry/nextjs";
import { Button } from "@repo/ui/components/ui/button";
import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import { LightfastErrorPage, ErrorCode } from "@repo/ui/components/lightfast-error-page";

interface NewChatErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function NewChatError({ error, reset }: NewChatErrorProps) {
	useEffect(() => {
		// Capture all errors to Sentry for new chat page
		captureException(error);
		
		// Always log for local debugging
		console.error("New chat error:", error);
	}, [error]);

	// Handle errors on new chat page
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
					description="Something went wrong starting a new chat."
					errorId={error.digest}
				>
					<Button onClick={() => reset()}>Try again</Button>
					<Button variant="outline" asChild>
						<Link href="/">Go Home</Link>
					</Button>
				</LightfastErrorPage>
			</LightfastCustomGridBackground.Container>
		</LightfastCustomGridBackground.Root>
	);
}