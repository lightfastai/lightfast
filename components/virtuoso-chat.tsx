"use client";

import {
	VirtuosoMessageList,
	VirtuosoMessageListLicense,
	type VirtuosoMessageListProps,
} from "@virtuoso.dev/message-list";
import type { ChatStatus, ToolUIPart } from "ai";
import { useMemo, useRef } from "react";
import { Markdown } from "@/components/markdown";
import { env } from "@/env";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { isTextPart, isToolPart } from "@/types/lightfast-ui-messages";
import { ToolCallRenderer } from "./tool-renderers/tool-call-renderer";

interface VirtuosoChatProps {
	messages: LightfastUIMessage[];
	status: ChatStatus;
}

const ItemContent: VirtuosoMessageListProps<LightfastUIMessage, null>["ItemContent"] = ({ data }) => {
	const message = data;

	// For user messages, just show the text content
	if (message.role === "user") {
		const textContent =
			message.parts
				?.filter(isTextPart)
				.map((part) => part.text)
				.join("\n") || "";

		return (
			<div className="pb-12">
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
		<div className="pb-12">
			<div className="mx-auto max-w-3xl px-4 space-y-4">
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

						return (
							<div key={`${message.id}-part-${index}`} className="w-full">
								<ToolCallRenderer toolPart={part as ToolUIPart} toolName={toolName} />
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

export function VirtuosoChat({ messages, status }: VirtuosoChatProps) {
	const prevMessageLength = useRef<number>(0);
	const lastStreamingMessageId = useRef<string | null>(null);

	// Compute data with minimal dependencies
	const virtuosoData = useMemo(() => {
		const lastMessage = messages[messages.length - 1];
		const hasNewMessage = messages.length !== prevMessageLength.current;

		// Track if we're streaming a new message
		if (status === "streaming" && lastMessage?.role === "assistant") {
			if (lastMessage.id !== lastStreamingMessageId.current) {
				lastStreamingMessageId.current = lastMessage.id;
			}
		}

		// New user message: auto-scroll
		if (hasNewMessage && lastMessage?.role === "user") {
			prevMessageLength.current = messages.length;
			return {
				data: messages,
				scrollModifier: {
					type: "auto-scroll-to-bottom" as const,
					autoScroll: ({ atBottom, scrollInProgress }: { atBottom: boolean; scrollInProgress: boolean }) => ({
						index: "LAST" as const,
						align: "start" as const,
						behavior: (atBottom || scrollInProgress ? "smooth" : "auto") as "smooth" | "auto",
					}),
				},
			};
		}

		// New assistant message: no scroll
		if (hasNewMessage && lastMessage?.role === "assistant") {
			prevMessageLength.current = messages.length;
			return { data: messages };
		}

		// Streaming content: items-change (only when actively streaming)
		if (status === "streaming" && lastMessage?.id === lastStreamingMessageId.current) {
			return {
				data: messages,
				scrollModifier: {
					type: "items-change" as const,
					behavior: "smooth" as const,
				},
			};
		}

		// Default: just update data
		return { data: messages };
	}, [
		messages,
		status,
		// Note: We use the full messages array but useMemo will only
		// recompute when the reference changes, which is less frequent
		// than content updates during streaming
	]);

	return (
		<VirtuosoMessageListLicense licenseKey={env.NEXT_PUBLIC_VIRTUOSO_LICENSE_KEY || ""}>
			<VirtuosoMessageList<LightfastUIMessage, null>
				style={{ flex: 1, height: "100%" }}
				data={virtuosoData}
				computeItemKey={({ data }) => data.id || `message-${data}`}
				ItemContent={ItemContent}
				initialLocation={messages.length > 0 ? { index: "LAST", align: "end" } : undefined}
			/>
		</VirtuosoMessageListLicense>
	);
}
