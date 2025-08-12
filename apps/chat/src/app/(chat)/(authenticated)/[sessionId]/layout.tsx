import { prefetch, trpc, HydrateClient } from "~/trpc/server";

interface SessionLayoutProps {
	children: React.ReactNode;
	params: Promise<{
		sessionId: string;
	}>;
}

// Layout component that prefetches data for all session pages
export default async function SessionLayout({ children, params }: SessionLayoutProps) {
	const { sessionId } = await params;
	
	// Prefetch the session data to make it instantly available in SessionChatWrapper
	// This populates the cache so the client component doesn't need to fetch again
	prefetch(trpc.chat.session.get.queryOptions({ sessionId }));

	// Wrap in HydrateClient to ensure the prefetched session data is included in hydration
	// This is critical for useSuspenseQuery to work correctly in production
	return <HydrateClient>{children}</HydrateClient>;
}