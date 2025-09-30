import type { PromptInputAttachmentPayload } from "@repo/ui/components/ai-elements/prompt-input";
import type { JSONValue } from "ai";
import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";

export interface UploadedAttachment {
	id: string;
	url: string;
	storagePath: string;
	size: number;
	contentType: string;
	filename?: string;
	metadata: Record<string, JSONValue> | null;
}

/**
 * Checks if an attachment has been fully resolved (uploaded and has all required metadata).
 */
export function isAttachmentResolved(attachment: PromptInputAttachmentPayload): boolean {
	const hasStoragePath = Boolean(attachment.storagePath);
	const hasSize = typeof attachment.size === "number";
	const hasAnyContentType =
		typeof attachment.contentType === "string" && attachment.contentType.length > 0
			? true
			: typeof attachment.mediaType === "string" && attachment.mediaType.length > 0;

	return hasStoragePath && hasSize && hasAnyContentType;
}

/**
 * Finds the first unresolved attachment in a list.
 * Returns the attachment if found, or undefined if all are resolved.
 */
export function findUnresolvedAttachment(
	attachments: PromptInputAttachmentPayload[],
): PromptInputAttachmentPayload | undefined {
	return attachments.find((attachment) => !isAttachmentResolved(attachment));
}

/**
 * Converts a PromptInputAttachmentPayload to an UploadedAttachment.
 * Throws an error if the attachment is not fully resolved.
 */
export function convertToUploadedAttachment(
	attachment: PromptInputAttachmentPayload,
): UploadedAttachment {
	if (!attachment.storagePath || typeof attachment.size !== "number" || !attachment.url) {
		throw new Error("Attachment missing upload metadata.");
	}

	let inferredContentType: string;
	if (typeof attachment.contentType === "string" && attachment.contentType.length > 0) {
		inferredContentType = attachment.contentType;
	} else if (
		typeof attachment.mediaType === "string" &&
		attachment.mediaType.length > 0
	) {
		inferredContentType = attachment.mediaType;
	} else {
		inferredContentType = "application/octet-stream";
	}

	return {
		id: attachment.id,
		url: attachment.url,
		storagePath: attachment.storagePath,
		size: attachment.size,
		contentType: inferredContentType,
		filename: attachment.filename ?? undefined,
		metadata: attachment.metadata as Record<string, JSONValue> | null,
	};
}

/**
 * Converts a list of PromptInputAttachmentPayloads to UploadedAttachments.
 */
export function convertAttachmentsToUploaded(
	attachments: PromptInputAttachmentPayload[],
): UploadedAttachment[] {
	return attachments.map(convertToUploadedAttachment);
}

/**
 * Creates message parts from text and uploaded attachments.
 */
export function createMessageParts(
	text: string,
	uploadedAttachments: UploadedAttachment[],
): LightfastAppChatUIMessage["parts"] {
	const parts: LightfastAppChatUIMessage["parts"] = [];

	if (text.length > 0) {
		parts.push({ type: "text", text });
	}

	for (const uploaded of uploadedAttachments) {
		parts.push({
			type: "file",
			url: uploaded.url,
			mediaType: uploaded.contentType,
			filename: uploaded.filename ?? undefined,
			providerMetadata: {
				storage: {
					provider: "vercel-blob",
					id: uploaded.id,
					pathname: uploaded.storagePath,
					size: uploaded.size,
					metadata: uploaded.metadata,
				},
			},
		});
	}

	return parts;
}

/**
 * Generates a seed text for session creation from message content.
 * Uses the text if available, otherwise uses attachment filenames.
 */
export function generateSessionSeedText(
	text: string,
	uploadedAttachments: UploadedAttachment[],
): string {
	if (text.length > 0) {
		return text;
	}
	return uploadedAttachments
		.map((attachment) => attachment.filename ?? attachment.contentType)
		.join(", ");
}
