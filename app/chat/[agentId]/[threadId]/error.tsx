"use client";

import { ChatLayout } from "@/components/chat/chat-layout";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {

	return (
		<ChatLayout>
			<div className="flex h-full items-center justify-center p-6">
				<div className="text-center">
					<h2 className="text-xl font-semibold mb-2">Something went wrong!</h2>
					<p className="text-muted-foreground mb-4">{error.message}</p>
					<button
						type="button"
						onClick={reset}
						className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
					>
						Try again
					</button>
				</div>
			</div>
		</ChatLayout>
	);
}
