import { Suspense } from "react";
import { NewSessionChat } from "../_components/new-session-chat";
import { HydrateClient } from "~/trpc/server";

interface NewChatPageProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewChatPage({ searchParams }: NewChatPageProps) {
	const params = await searchParams;
	const agentId = "c010";
	const isTemporary = (() => {
		const value = params.mode ?? params.temporary;
		if (Array.isArray(value)) {
			return value.some((item) => item === "temporary" || item === "1");
		}
		return value === "temporary" || value === "1";
	})();

	// Wrap in HydrateClient to enable instant hydration of prefetched data
	// User data is already prefetched in the authenticated layout
	// Session ID is generated client-side in NewSessionChat
	return (
		<>
			<HydrateClient>
				<Suspense fallback={<div className="bg-background h-full" />}>
					<NewSessionChat
						agentId={agentId}
						mode={isTemporary ? "temporary" : "permanent"}
					/>
				</Suspense>
			</HydrateClient>
		</>
	);
}
