"use client";

import {
	VirtuosoMessageList,
	VirtuosoMessageListLicense,
	type VirtuosoMessageListProps,
} from "@virtuoso.dev/message-list";
import type { ToolUIPart } from "ai";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { env } from "@/env";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { isTextPart, isToolPart } from "@/types/lightfast-ui-messages";
import { ToolCallRenderer } from "./tool-renderers/tool-call-renderer";

interface VirtuosoChatProps {
	messages: LightfastUIMessage[];
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

export function VirtuosoChat({ messages }: VirtuosoChatProps) {
	const [data, setData] = useState<VirtuosoMessageListProps<LightfastUIMessage, null>["data"]>({
		data: messages,
	});
	const prevMessageLength = useRef<number>(0);

	useEffect(() => {
		// Always update data with current messages (for streaming content updates)
		// But only add scroll modifier when length changes (new messages)
		const hasNewMessages = messages.length !== prevMessageLength.current;
		const lastMessage = messages[messages.length - 1];

		if (hasNewMessages && lastMessage?.role === "user") {
			// Apply scroll modifier only for new user messages
			setData({
				data: messages,
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
			prevMessageLength.current = messages.length;
		} else {
			// Just update data without scroll modifier (for assistant messages or content streaming)
			setData({ data: messages });
			if (hasNewMessages) {
				prevMessageLength.current = messages.length;
			}
		}
	}, [messages.length]); // Keep as messages.length to avoid re-running during streaming

	return (
		<VirtuosoMessageListLicense licenseKey={env.NEXT_PUBLIC_VIRTUOSO_LICENSE_KEY || ""}>
			<VirtuosoMessageList<LightfastUIMessage, null>
				style={{ flex: 1, height: "100%" }}
				data={data}
				computeItemKey={({ data }) => data.id || `message-${data}`}
				ItemContent={ItemContent}
				initialLocation={messages.length > 0 ? { index: "LAST", align: "end" } : undefined}
			/>
		</VirtuosoMessageListLicense>
	);
}
