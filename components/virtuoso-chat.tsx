"use client";

import {
	VirtuosoMessageList,
	VirtuosoMessageListLicense,
	type VirtuosoMessageListProps,
} from "@virtuoso.dev/message-list";
import type { ToolUIPart } from "ai";
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
	return (
		<VirtuosoMessageListLicense licenseKey={env.NEXT_PUBLIC_VIRTUOSO_LICENSE_KEY || ""}>
			<VirtuosoMessageList<LightfastUIMessage, null>
				style={{ flex: 1, height: "100%" }}
				data={{ data: messages }}
				computeItemKey={({ data }) => data.id || `message-${data}`}
				ItemContent={ItemContent}
				initialLocation={messages.length > 0 ? { index: "LAST", align: "end" } : undefined}
			/>
		</VirtuosoMessageListLicense>
	);
}
