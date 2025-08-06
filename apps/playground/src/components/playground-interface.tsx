"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatInput } from "./chat-input";
import { BrowserContainer } from "./browser-container";
import { EmptyState } from "./empty-state";
import { ChatMessages } from "./chat-messages";
import { PlaygroundHeader } from "./playground-header";
import { PlaygroundLayout } from "./layouts/playground-layout";
import { ChatSection } from "./layouts/chat-section";
import { BrowserSection } from "./layouts/browser-section";
import { useChat } from "~/hooks/use-chat";
import { AgentId } from "~/app/(agents)/types";
import type { PlaygroundUIMessage } from "~/types/playground-ui-messages";
import { BrowserProvider } from "~/contexts/browser-context";

interface PlaygroundInterfaceProps {
	threadId: string;
	initialMessages: PlaygroundUIMessage[];
}

/**
 * Inner component that uses browser context
 */
function PlaygroundInterfaceInner({
	threadId,
	initialMessages,
}: PlaygroundInterfaceProps) {
	const router = useRouter();

	// Use the chat hook with the browser agent
	const { messages, sendMessage, status, isLoading } = useChat({
		agentId: AgentId.BROWSER_010,
		threadId,
		initialMessages,
		onError: (error) => {
			console.error("Chat error:", error);
			// TODO: Add toast notification for user feedback
		},
	});

	// Update URL to include thread ID when first message is sent
	useEffect(() => {
		if (messages.length > 0 && window.location.pathname === "/playground") {
			// Use history.replaceState to update URL without adding to history
			window.history.replaceState(null, "", `/playground/${threadId}`);
		}
	}, [messages.length, threadId]);

	const handleSendMessage = async (message: string) => {
		try {
			await sendMessage(message);
		} catch (error) {
			console.error("Failed to send message:", error);
			// Error is already handled by onError callback
		}
	};

	// Always render the full interface if we have messages
	if (messages.length > 0) {
		return (
			<PlaygroundLayout
				header={<PlaygroundHeader />}
				sidebar={
					<ChatSection
						messages={<ChatMessages messages={messages} status={status} />}
						input={
							<ChatInput
								onSendMessage={handleSendMessage}
								placeholder="Ask the browser agent to navigate, interact, or extract data..."
								disabled={isLoading}
							/>
						}
					/>
				}
				main={
					<BrowserSection>
						<BrowserContainer threadId={threadId} />
					</BrowserSection>
				}
			/>
		);
	}

	// For empty state, center the content in the middle of the page
	return (
		<div className="h-screen flex flex-col relative">
			<PlaygroundHeader />
			<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
				<div className="w-full max-w-3xl px-4 pointer-events-auto">
					<div className="px-4">
						<EmptyState />
					</div>
					<ChatInput
						onSendMessage={handleSendMessage}
						placeholder="Ask the browser agent to navigate, interact, or extract data..."
						disabled={isLoading}
					/>
				</div>
			</div>
		</div>
	);
}

/**
 * PlaygroundInterface with optimized server/client boundaries
 * Server-renders static content and progressively enhances with client features
 */
export function PlaygroundInterface(props: PlaygroundInterfaceProps) {
	return (
		<BrowserProvider>
			<PlaygroundInterfaceInner {...props} />
		</BrowserProvider>
	);
}
