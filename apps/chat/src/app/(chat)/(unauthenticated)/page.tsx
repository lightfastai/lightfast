import { UnauthenticatedChat } from "./_components/unauthenticated-chat";

// Server component for unauthenticated chat
export default function UnauthenticatedChatPage() {
	const agentId = "c010";

	// Use the UnauthenticatedChat component for consistency with authenticated flow
	return <UnauthenticatedChat agentId={agentId} />;
}