import type { ChatError } from "~/lib/errors/types";

export interface ChatInlineError {
	id: string;
	error: ChatError;
	relatedAssistantMessageId?: string;
	relatedUserMessageId?: string;
	category?: string;
	severity?: string;
	source?: string;
	errorCode?: string;
}
