"use client";

import {
	VirtuosoMessageList,
	VirtuosoMessageListLicense,
	type VirtuosoMessageListMethods,
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
			<div className={`${isLastMessage ? "pb-20" : "pb-12"} px-4`}>
				<div className="mx-auto max-w-3xl flex justify-end">
					<div className="max-w-[80%] border border-muted/30 rounded-xl px-4 py-1 bg-transparent dark:bg-input/30">
						<p className="whitespace-pre-wrap">{textContent}</p>
					</div>
				</div>
			</div>
		);
	}

	// For assistant messages, render parts in order
	return (
		<div className={`${isLastMessage ? "pb-20" : "pb-12"} px-4`}>
			<div className="mx-auto max-w-3xl space-y-4">
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
	const virtuoso = React.useRef<VirtuosoMessageListMethods<VirtuosoMessage>>(null);
	const prevMessagesLength = React.useRef(0);
	const [isAtBottom, _setIsAtBottom] = React.useState(true);

	// Auto-scroll to bottom when new messages are added
	React.useEffect(() => {
		if (!virtuoso.current) return;

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

		// If this is the first load or messages were cleared, set initial data
		if (prevMessagesLength.current === 0 && virtuosoMessages.length > 0) {
			virtuoso.current.data.replace(virtuosoMessages);
		}
		// If new messages were added, append them
		else if (virtuosoMessages.length > prevMessagesLength.current) {
			const newMessages = virtuosoMessages.slice(prevMessagesLength.current);
			virtuoso.current.data.append(newMessages, ({ scrollInProgress, atBottom }) => {
				// Only auto-scroll if user is at bottom or scrolling
				if (atBottom || scrollInProgress || isAtBottom) {
					return {
						index: "LAST",
						align: "start",
						behavior: "smooth",
					};
				}
				return false;
			});
		}
		// If messages were modified (e.g., loading state changed), update them
		else if (virtuosoMessages.length === prevMessagesLength.current) {
			virtuoso.current.data.map((message) => {
				const updated = virtuosoMessages.find((m) => m.key === message.key);
				return updated || message;
			}, "smooth");
		}

		prevMessagesLength.current = virtuosoMessages.length;
	}, [messages, isLoading, isAtBottom]);

	return (
		<VirtuosoMessageListLicense licenseKey={env.NEXT_PUBLIC_VIRTUOSO_LICENSE_KEY || ""}>
			<VirtuosoMessageList<VirtuosoMessage, null>
				ref={virtuoso}
				className="h-full w-full"
				computeItemKey={({ data }) => data.key}
				ItemContent={ItemContent}
			/>
		</VirtuosoMessageListLicense>
	);
}
