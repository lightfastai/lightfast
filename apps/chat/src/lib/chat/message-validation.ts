import {
	MAX_ATTACHMENT_BYTES,
	ensureAttachmentAllowed,
	inferAttachmentKind,
} from "@repo/chat-ai-types";
import type {
	PromptInputAttachmentPayload,
} from "@repo/ui/components/ai-elements/prompt-input";
import { ChatErrorType } from "@repo/chat-ai-types/errors";

interface ValidationError {
	type: ChatErrorType;
	message: string;
	retryable: false;
	details?: string;
	metadata?: Record<string, unknown>;
}

interface ValidationOptions {
	supportsImageAttachments: boolean;
	supportsPdfAttachments: boolean;
}

/**
 * Validates a single attachment against model capabilities and size constraints.
 * Returns null if valid, or a ValidationError if invalid.
 */
export function validateAttachment(
	attachment: PromptInputAttachmentPayload,
	options: ValidationOptions,
): ValidationError | null {
	const mediaType = attachment.mediaType;
	const filename = attachment.filename ?? "attachment";
	const size = attachment.size;
	const kind = inferAttachmentKind(mediaType, filename);

	// Check file size
	if (typeof size === "number" && size > MAX_ATTACHMENT_BYTES) {
		return {
			type: ChatErrorType.INVALID_REQUEST,
			message: `"${filename}" is too large. Attachments must be under ${Math.floor(
				MAX_ATTACHMENT_BYTES / (1024 * 1024),
			)}MB.`,
			retryable: false,
			metadata: { filename, kind },
		};
	}

	// Check if size is available
	if (typeof size !== "number") {
		return {
			type: ChatErrorType.INVALID_REQUEST,
			message: `Unable to determine the size of "${filename}". Please reattach the file.`,
			retryable: false,
			metadata: { filename, kind },
		};
	}

	// Check if attachment type is allowed for this model
	const allowed = ensureAttachmentAllowed(kind, {
		allowImages: options.supportsImageAttachments,
		allowPdf: options.supportsPdfAttachments,
	});

	if (!allowed) {
		let errorMessage = "Only images and PDF files can be attached.";
		if (kind === "image" && !options.supportsImageAttachments) {
			errorMessage = "This model does not support image attachments.";
		} else if (kind === "pdf" && !options.supportsPdfAttachments) {
			errorMessage = "This model does not support PDF attachments.";
		}

		return {
			type: ChatErrorType.INVALID_REQUEST,
			message: errorMessage,
			retryable: false,
			metadata: { filename, mediaType, kind },
		};
	}

	return null;
}

/**
 * Validates all attachments in a message.
 * Returns the first error found, or null if all attachments are valid.
 */
export function validateAttachments(
	attachments: PromptInputAttachmentPayload[],
	options: ValidationOptions,
): ValidationError | null {
	for (const attachment of attachments) {
		const error = validateAttachment(attachment, options);
		if (error) {
			return error;
		}
	}
	return null;
}
