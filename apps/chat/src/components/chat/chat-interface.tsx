"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { AppEmptyState } from "@repo/ui/components/app-empty-state";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "@repo/ui/components/chat/chat-input";
import { useChat } from "~/hooks/use-chat";
import { uuidv4 } from "@lightfast/core/v2/utils";

enum ChatStateType {
	UNAUTHENTICATED = "unauthenticated",
	AUTHENTICATED_NEW = "authenticated-new",
	AUTHENTICATED_THREAD = "authenticated-thread",
	UNKNOWN = "unknown",
}

interface ChatState {
	type: ChatStateType;
	id: string | null;
	isNew: boolean;
}

export function ChatInterface() {
	const pathname = usePathname();

	// Determine chat state from pathname
	const chatState = useMemo<ChatState>(() => {
		// Unauthenticated root
		if (pathname === "/") {
			return { type: ChatStateType.UNAUTHENTICATED, id: null, isNew: true };
		}

		// Authenticated new chat
		if (pathname === "/new") {
			return { type: ChatStateType.AUTHENTICATED_NEW, id: null, isNew: true };
		}

		// Authenticated thread
		const threadMatch = pathname.match(/^\/([^/]+)$/);
		if (threadMatch) {
			return {
				type: ChatStateType.AUTHENTICATED_THREAD,
				id: threadMatch[1],
				isNew: false,
			};
		}

		return { type: ChatStateType.UNKNOWN, id: null, isNew: false };
	}, [pathname]);

	// Generate or use existing sessionId
	const sessionId = chatState.id || uuidv4();
	
	// Use the chat hook with c010 agent by default
	const { messages, sendMessage, status, isLoading } = useChat({
		agentId: "c010",
		sessionId,
		initialMessages: [],
		onError: (error) => {
			console.error("Chat error:", error);
		},
	});

	const handleSendMessage = async (message: string) => {
		try {
			// If this is a new chat, update the URL to include the sessionId
			if (chatState.isNew) {
				const newPath = chatState.type === ChatStateType.UNAUTHENTICATED 
					? `/${sessionId}` 
					: `/${sessionId}`;
				window.history.replaceState({}, "", newPath);
			}
			
			await sendMessage(message);
		} catch (error) {
			console.error("Failed to send message:", error);
		}
	};

	// For new chats (no messages yet), show centered layout
	if (chatState.isNew && messages.length === 0) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="w-full max-w-3xl px-4">
					<div className="px-4">
						<AppEmptyState
							title="Chat"
							description="Experience the power of Lightfast AI. Start chatting to explore."
						/>
					</div>
					<ChatInput
						onSendMessage={handleSendMessage}
						placeholder="Ask anything..."
					/>
				</div>
			</div>
		);
	}

	// Thread view or chat with existing messages
	return (
		<div className="flex flex-col h-full">
			<ChatMessages
				threadId={chatState.id}
				messages={messages}
				isLoading={isLoading}
			/>
			<div className="relative bg-background">
				<div className="max-w-3xl mx-auto p-4">
					<ChatInput
						onSendMessage={handleSendMessage}
						placeholder="Continue the conversation..."
						withGradient={true}
						withDescription="Chat with Lightfast AI"
					/>
				</div>
			</div>
		</div>
	);
}

