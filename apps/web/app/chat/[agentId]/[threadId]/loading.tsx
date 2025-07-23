import { ChatLayout } from "@/components/chat/chat-layout";
import { ChatSkeleton } from "@/components/chat/chat-skeleton";

export default function Loading() {
	return (
		<ChatLayout>
			<ChatSkeleton />
		</ChatLayout>
	);
}
