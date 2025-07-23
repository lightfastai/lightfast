import { ChatSkeleton } from "@/components/chat/chat-skeleton";

/**
 * Loading state for thread-level routes
 * Shows while thread data and messages are being fetched
 * Layout is already rendered at agent level, so we only show content skeleton
 */
export default function ThreadLoading() {
	return <ChatSkeleton />;
}
