"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrowserContainer } from "./browser-container";
import { AppEmptyState } from "@repo/ui/components/app-empty-state";
import { ChatInput } from "@repo/ui/components/chat/chat-input";
import { ChatMessages } from "./chat/chat-messages";
import { AuthenticatedHeader } from "./layouts/authenticated-header";
import { PlaygroundLayout } from "./layouts/playground-layout";
import { ChatSection } from "./layouts/chat-section";
import { BrowserSection } from "./layouts/browser-section";
import { useChat } from "~/hooks/use-chat";
import { AgentId } from "~/app/(agents)/types";
import type { PlaygroundUIMessage } from "~/types/playground-ui-messages";
import { BrowserProvider } from "~/contexts/browser-context";

interface PlaygroundInterfaceProps {
	sessionId: string;
	initialMessages: PlaygroundUIMessage[];
}

/**
 * Inner component that uses browser context
 */
function PlaygroundInterfaceInner({
	sessionId,
	initialMessages,
}: PlaygroundInterfaceProps) {
	const router = useRouter();

	// Use the chat hook with the browser agent
	const { messages, sendMessage, status, isLoading } = useChat({
		agentId: AgentId.BROWSER_010,
		sessionId,
		initialMessages,
		onError: (error) => {
			console.error("Chat error:", error);
			// TODO: Add toast notification for user feedback
		},
	});

	// Update URL to include session ID when first message is sent
	useEffect(() => {
		if (messages.length > 0 && window.location.pathname === "/playground") {
			// Use history.replaceState like Vercel AI Chatbot for seamless URL update
			window.history.replaceState({}, "", `/playground/${sessionId}`);
		}
	}, [messages.length, sessionId]);

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
				header={<AuthenticatedHeader />}
				sidebar={
					<ChatSection
						messages={<ChatMessages messages={messages} status={status} />}
						input={
							<ChatInput
								onSendMessage={handleSendMessage}
								placeholder="Ask the browser agent to navigate, interact, or extract data..."
								disabled={isLoading}
								withGradient={true}
								withDescription="Playground is powered by Lightfast Cloud"
							/>
						}
					/>
				}
				main={
					<BrowserSection>
						<BrowserContainer sessionId={sessionId} />
					</BrowserSection>
				}
			/>
		);
	}

	// For empty state, center the content in the middle of the page
	return (
		<div className="h-screen flex flex-col relative">
			<AuthenticatedHeader />
			<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
				<div className="w-full max-w-3xl px-4 pointer-events-auto">
					<div className="px-4">
						<AppEmptyState 
							title="Playground"
							description="This is the Lightfast playground. Test and experiment with AI agent capabilities in a safe environment."
						/>
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
			<PlaygroundInterfaceInner key={props.sessionId} {...props} />
		</BrowserProvider>
	);
}
