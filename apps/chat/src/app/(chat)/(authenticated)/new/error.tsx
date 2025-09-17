"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@sentry/nextjs";
import { Button } from "@repo/ui/components/ui/button";
import { LightfastCustomGridBackground } from "@repo/ui/components/lightfast-custom-grid-background";
import { LightfastErrorPage } from "@repo/ui/components/lightfast-error-page";
import { ChatErrorHandler } from "~/services/chat-error-handler.service";

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

	const { errorCode, description } = ChatErrorHandler.getErrorPageConfig(error, "new");

	return (
		<LightfastCustomGridBackground.Root
			marginVertical="25vh"
			marginHorizontal="25vw"
			marginVerticalMobile="25vh"
			marginHorizontalMobile="10vw"
		>
			<LightfastCustomGridBackground.Container>
				<LightfastErrorPage
					code={errorCode}
					description={description}
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