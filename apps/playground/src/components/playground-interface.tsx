"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatInput } from "./chat-input";
import { BrowserContainer } from "./browser-container";
import { EmptyState } from "./empty-state";
import { Message } from "./message";
import { useChat } from "~/hooks/use-chat";
import { AgentId } from "~/app/(agents)/types";
import type { PlaygroundUIMessage } from "~/types/playground-ui-messages";
import { BrowserProvider, useBrowser } from "~/contexts/browser-context";

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
	const { updateBrowserState } = useBrowser();
	
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

	// Update browser state when messages change
	useEffect(() => {
		// Look for the latest screenshot or navigation in messages
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i];
			if (message.role === "assistant") {
				for (const part of message.parts) {
					// Check for screenshot results
					if (part.type === "tool-result-stagehandScreenshot" && "result" in part && part.result) {
						const result = part.result as { screenshot?: string };
						if (result.screenshot) {
							updateBrowserState({ screenshot: result.screenshot });
							return;
						}
					}
					// Check for navigation
					if (part.type === "tool-call-stagehandNavigate" && "args" in part && part.args) {
						const args = part.args as { url?: string };
						if (args.url) {
							updateBrowserState({ url: args.url, isLoading: true });
						}
					}
				}
			}
		}
	}, [messages, updateBrowserState]);

	// Update URL to include thread ID when first message is sent
	useEffect(() => {
		if (messages.length > 0 && window.location.pathname === "/playground") {
			// Use router.replace to update URL without adding to history
			router.replace(`/playground/${threadId}`);
		}
	}, [messages.length, threadId, router]);

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
			<div className="flex-1 flex flex-col">
				<div className="flex-1 app-container">
					<div className="grid grid-cols-10 gap-0 h-full">
						{/* Chat section - 30% */}
						<div className="col-span-3 flex flex-col">
							{/* Messages area */}
							<div className="flex-1 overflow-auto py-4 px-4">
								{messages.map((message) => (
									<Message key={message.id} message={message} />
								))}
								{/* Show loading indicator when streaming */}
								{isLoading && (
									<div className="mb-4 text-left">
										<div className="inline-block p-3 rounded-lg bg-muted">
											<div className="flex items-center gap-2">
												<div className="animate-pulse">●</div>
												<div className="animate-pulse delay-100">●</div>
												<div className="animate-pulse delay-200">●</div>
											</div>
										</div>
									</div>
								)}
							</div>

							{/* Input area */}
							<div className="flex-shrink-0 pb-4">
								<ChatInput
									onSendMessage={handleSendMessage}
									placeholder="Ask the browser agent to navigate, interact, or extract data..."
									disabled={isLoading}
								/>
							</div>
						</div>

						{/* Right section - 70% */}
						<div className="col-span-7 border border-border/50 rounded-sm shadow-lg">
							<BrowserContainer />
						</div>
					</div>
				</div>
			</div>
		);
	}

	// For empty state, center the content in the middle of the page
	return (
		<div className="flex-1 flex items-center justify-center">
			<div className="w-full max-w-3xl px-4">
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

