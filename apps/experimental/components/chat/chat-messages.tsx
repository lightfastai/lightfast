"use client";

import type { LightfastUIMessage } from "@lightfast/types";
import type { ChatStatus } from "ai";
import { VirtuosoChat } from "@/components/virtuoso-chat";

interface ChatMessagesProps {
	messages: LightfastUIMessage[];
	status: ChatStatus;
}

export function ChatMessages({ messages, status }: ChatMessagesProps) {
	return (
		<div className="flex-1 relative min-h-0 overflow-hidden">
			<div className="absolute inset-0 pt-2 sm:pt-4 lg:pt-6 pb-2">
				<div className="h-full">
					<VirtuosoChat messages={messages} status={status} />
				</div>
			</div>
		</div>
	);
}
