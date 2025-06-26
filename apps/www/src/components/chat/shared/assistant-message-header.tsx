"use client";

import type { Doc } from "../../../../convex/_generated/dataModel";

interface AssistantMessageHeaderProps {
	modelName?: string;
	usedUserApiKey?: boolean;
	isStreaming?: boolean;
	isComplete?: boolean;
	thinkingStartedAt?: number;
	thinkingCompletedAt?: number;
	streamingText?: string;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
		reasoningTokens?: number;
		cachedInputTokens?: number;
	};
	hasParts?: boolean;
	message?: Doc<"messages">;
}

export function AssistantMessageHeader({
	isStreaming,
	isComplete,
	streamingText,
	hasParts,
	message,
}: AssistantMessageHeaderProps) {
	// Check if message has any actual content
	const hasContent = (() => {
		// First check streamingText
		if (streamingText && streamingText.trim().length > 0) return true;

		// Check if message has parts with content
		if (hasParts && message?.parts && message.parts.length > 0) {
			return message.parts.some(
				(part) =>
					(part.type === "text" && part.text && part.text.trim().length > 0) ||
					part.type === "tool-call",
			);
		}

		// Check message body as fallback
		if (message?.body && message.body.trim().length > 0) return true;

		return false;
	})();

	// Only show "Thinking" when streaming but no content has appeared yet
	if (isStreaming && !isComplete && !hasContent) {
		return (
			<div className="text-xs text-muted-foreground mb-2 flex items-center gap-2 min-h-5">
				<span>Thinking...</span>
			</div>
		);
	}

	// Don't show header for completed messages or when content is showing
	return null;
}
