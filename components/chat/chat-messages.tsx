"use client";

import { VirtuosoChat } from "@/components/virtuoso-chat";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { env } from "@/env";

interface ChatMessagesProps {
	messages: LightfastUIMessage[];
	isLoading: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
	// Only use license key in production
	const licenseKey = env.NODE_ENV === "production" ? env.VIRTUOSO_LICENSE_KEY : undefined;

	return (
		<div className="flex-1 relative min-h-0">
			<div className="absolute inset-0 pt-6">
				<VirtuosoChat messages={messages} isLoading={isLoading} licenseKey={licenseKey} />
			</div>
		</div>
	);
}
