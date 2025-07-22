"use client";

import { VirtuosoChat } from "@/components/virtuoso-chat";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

interface ChatMessagesProps {
	messages: LightfastUIMessage[];
	isLoading: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
	return (
		<div className="flex-1 relative min-h-0 overflow-hidden">
			<div className="absolute inset-0 pt-2 sm:pt-4 lg:pt-6 pb-2">
				<div className="h-full">
					<VirtuosoChat messages={messages} isLoading={isLoading} />
				</div>
			</div>
		</div>
	);
}
