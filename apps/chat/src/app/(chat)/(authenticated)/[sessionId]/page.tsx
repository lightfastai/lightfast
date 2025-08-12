import { notFound } from "next/navigation";
import { SessionChatWrapper } from "~/components/chat/session-chat-wrapper";
import { getQueryClient, trpc } from "~/trpc/server";

interface SessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

// Server component - validates session exists before rendering
export default async function SessionPage({ params }: SessionPageProps) {
	const { sessionId } = await params;
	const agentId = "c010";

	// Check if session exists on the server using fetchQuery
	// This will throw if session doesn't exist or user doesn't have access
	try {
		const queryClient = getQueryClient();
		await queryClient.fetchQuery(
			trpc.chat.session.get.queryOptions({ sessionId })
		);
	} catch (error) {
		// If session not found or user doesn't have access, show 404
		// This happens during server-side rendering, avoiding the client-side error
		notFound();
	}

	// Session exists and user has access - render the chat interface
	return <SessionChatWrapper sessionId={sessionId} agentId={agentId} />;
}

