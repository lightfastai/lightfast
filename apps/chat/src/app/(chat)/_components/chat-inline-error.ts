import type { ChatError } from "~/lib/errors/types";

export interface ChatInlineError {
	id: string;
	error: ChatError;
	relatedAssistantMessageId?: string;
	relatedUserMessageId?: string;
	phase?: string;
	errorCode?: string;
}
