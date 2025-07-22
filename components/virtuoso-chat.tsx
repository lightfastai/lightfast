"use client";

import {
	VirtuosoMessageList,
	VirtuosoMessageListLicense,
	type VirtuosoMessageListProps,
} from "@virtuoso.dev/message-list";
import * as React from "react";
import { Markdown } from "@/components/markdown";
import { ThinkingAnimation } from "@/components/thinking-animation";
import { env } from "@/env";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { isTextPart, isToolPart } from "@/types/lightfast-ui-messages";
import { ToolCallRenderer } from "./tool-renderers/tool-call-renderer";

interface VirtuosoMessage {
	key: string;
	message: LightfastUIMessage;
	isLoading?: boolean;
	isLastMessage?: boolean;
}

interface VirtuosoChatProps {
	messages: LightfastUIMessage[];
	isLoading: boolean;
}

const ItemContent: VirtuosoMessageListProps<VirtuosoMessage, null>["ItemContent"] = ({ data }) => {
	const { message, isLoading, isLastMessage } = data;

	// For user messages, just show the text content
	if (message.role === "user") {
		const textContent =
			message.parts
				?.filter(isTextPart)
				.map((part) => part.text)
				.join("\n") || "";

		return (
			<div className={`${isLastMessage ? "pb-20" : "pb-12"}`}>
				<div className="mx-auto max-w-3xl px-4 flex justify-end">
					<div className="max-w-[80%] border border-muted/30 rounded-xl px-4 py-1 bg-transparent dark:bg-input/30">
						<p className="whitespace-pre-wrap">{textContent}</p>
					</div>
				</div>
			</div>
		);
	}

	// For assistant messages, render parts in order
	return (
		<div className={`${isLastMessage ? "pb-20" : "pb-12"}`}>
			<div className="mx-auto max-w-3xl px-4 space-y-4">
				{/* Show thinking/done indicator at the top of assistant messages */}
				{message.role === "assistant" && (
					<div className="flex justify-start items-center gap-3">
						{isLoading ? (
							<>
								<ThinkingAnimation />
								<span className="text-sm text-muted-foreground">Thinking</span>
							</>
						) : (
							<>
								<div className="w-3 h-3 rounded-sm bg-muted" />
								<span className="text-sm text-muted-foreground">Done</span>
							</>
						)}
					</div>
				)}

				{message.parts?.map((part, index) => {
					// Text part
					if (isTextPart(part)) {
						return (
							<div key={`${message.id}-part-${index}`} className="w-full">
								<Markdown>{part.text}</Markdown>
							</div>
						);
					}

					// Tool part (e.g., "tool-webSearch", "tool-fileWrite")
					if (isToolPart(part)) {
						const toolName = part.type.replace("tool-", "");
						// biome-ignore lint/suspicious/noExplicitAny: Tool part types are complex and evolving
						const toolPart = part as any;

						return (
							<div key={`${message.id}-part-${index}`} className="w-full">
								<ToolCallRenderer toolPart={toolPart} toolName={toolName} />
							</div>
						);
					}

					// Unknown part type
					return null;
				})}
			</div>
		</div>
	);
};

export function VirtuosoChat({ messages, isLoading }: VirtuosoChatProps) {
	const [data, setData] = React.useState<VirtuosoMessageListProps<VirtuosoMessage, null>["data"]>(() => ({
		data: [],
	}));

	// Track previous messages to detect changes
	const prevMessagesRef = React.useRef<LightfastUIMessage[]>([]);

	React.useEffect(() => {
		// Convert messages to Virtuoso format
		const virtuosoMessages = messages.map((message, index) => {
			const isLastAssistantMessage = message.role === "assistant" && messages[messages.length - 1]?.id === message.id;
			const isLastMessage = index === messages.length - 1;

			return {
				key: message.id || `message-${index}`,
				message,
				isLoading: isLastAssistantMessage && isLoading,
				isLastMessage,
			};
		});

		// Check if a new user message was added (new question)
		const prevLength = prevMessagesRef.current.length;
		const newLength = messages.length;
		const isNewUserMessage = newLength > prevLength && messages[newLength - 1]?.role === "user";

		// Check if we're streaming an assistant response
		const lastMessage = messages[messages.length - 1];
		const prevLastMessage = prevMessagesRef.current[prevMessagesRef.current.length - 1];
		const isStreamingAssistant =
			lastMessage?.role === "assistant" && (lastMessage.id === prevLastMessage?.id || newLength > prevLength);

		if (isNewUserMessage) {
			// New user message - scroll to top to preallocate space for answer
			setData({
				data: virtuosoMessages,
				scrollModifier: {
					type: "auto-scroll-to-bottom",
					autoScroll: ({ scrollInProgress, atBottom }) => {
						return {
							index: "LAST",
							align: "start",
							behavior: atBottom || scrollInProgress ? "smooth" : "auto",
						};
					},
				},
			});
		} else if (isStreamingAssistant) {
			// Streaming assistant response - smooth scroll for content changes
			setData({
				data: virtuosoMessages,
				scrollModifier: {
					type: "items-change",
					behavior: "smooth",
				},
			});
		} else {
			// Other updates (e.g., loading state changes)
			setData({
				data: virtuosoMessages,
			});
		}

		prevMessagesRef.current = [...messages];
	}, [messages, isLoading]);

	return (
		<VirtuosoMessageListLicense licenseKey={env.NEXT_PUBLIC_VIRTUOSO_LICENSE_KEY || ""}>
			<VirtuosoMessageList<VirtuosoMessage, null>
				style={{ flex: 1, height: '100%' }}
				data={data}
				computeItemKey={({ data }) => data.key}
				ItemContent={ItemContent}
			/>
		</VirtuosoMessageListLicense>
	);
}
