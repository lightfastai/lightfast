import { useCallback, useState } from "react";
import type { ChatError, ChatInlineError } from "@repo/chat-ai-types/errors";

/**
 * Hook for managing inline chat errors that are displayed in the conversation.
 * These are non-fatal errors like streaming issues or validation errors.
 */
export function useInlineErrors() {
	const [inlineErrors, setInlineErrors] = useState<ChatInlineError[]>([]);

	const addInlineError = useCallback(
		(error: ChatError) => {
			const metadata: Record<string, unknown> = error.metadata ?? {};

			const getStringMetadata = (key: string): string | undefined => {
				const value = metadata[key];
				return typeof value === "string" ? value : undefined;
			};

			const relatedAssistantMessageId = getStringMetadata("messageId");
			const relatedUserMessageId = getStringMetadata("userMessageId");
			const errorCode = error.errorCode ?? getStringMetadata("errorCode");
			const category = error.category ?? getStringMetadata("category");
			const severity = error.severity ?? getStringMetadata("severity");
			const source = error.source ?? getStringMetadata("source");

			setInlineErrors((current) => {
				const entry: ChatInlineError = {
					id: crypto.randomUUID(),
					error,
					relatedAssistantMessageId,
					relatedUserMessageId,
					category,
					severity,
					source,
					errorCode,
				};

				const deduped = current.filter((existing) => {
					if (
						entry.relatedAssistantMessageId &&
						existing.relatedAssistantMessageId ===
							entry.relatedAssistantMessageId
					) {
						return false;
					}
					if (
						entry.relatedUserMessageId &&
						existing.relatedUserMessageId === entry.relatedUserMessageId &&
						!entry.relatedAssistantMessageId &&
						!existing.relatedAssistantMessageId
					) {
						return false;
					}
					if (
						!entry.relatedAssistantMessageId &&
						!entry.relatedUserMessageId &&
						!existing.relatedAssistantMessageId &&
						!existing.relatedUserMessageId &&
						existing.error.type === entry.error.type &&
						(existing.category ?? null) === (entry.category ?? null)
					) {
						return false;
					}
					return true;
				});

				return [...deduped, entry];
			});
		},
		[setInlineErrors],
	);

	const dismissInlineError = useCallback(
		(errorId: string) => {
			setInlineErrors((current) =>
				current.filter((entry) => entry.id !== errorId),
			);
		},
		[setInlineErrors],
	);

	return {
		inlineErrors,
		addInlineError,
		dismissInlineError,
	};
}
