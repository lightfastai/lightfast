import { toast } from "sonner";
import type { ChatErrorType } from "@repo/chat-ai-types/errors";

interface ChatToastError {
	type: ChatErrorType;
	message: string;
	details?: string;
}

/**
 * Show chat-specific error toast
 * Use for pre-flight validation, upload errors, user action feedback
 *
 * @example
 * showChatErrorToast({
 *   type: ChatErrorType.INVALID_REQUEST,
 *   message: "File too large",
 *   details: "Must be under 25MB"
 * });
 */
export function showChatErrorToast(error: ChatToastError): void {
	toast.error(error.message, {
		description: error.details,
		duration: 5000,
	});
}

/**
 * Show validation error toast (attachment, message, etc.)
 *
 * @example
 * showValidationErrorToast("Invalid file type", "Only images and PDFs are supported");
 */
export function showValidationErrorToast(message: string, details?: string): void {
	toast.error(message, {
		description: details,
		duration: 4000,
	});
}

/**
 * Show upload error toast
 *
 * @example
 * showUploadErrorToast("document.pdf", "Network connection lost");
 */
export function showUploadErrorToast(filename: string, reason?: string): void {
	toast.error("Upload failed", {
		description: reason ?? `Unable to upload "${filename}". Please try again.`,
		duration: 5000,
	});
}

/**
 * Show artifact error toast
 *
 * @example
 * showArtifactErrorToast("Artifact not found");
 */
export function showArtifactErrorToast(message: string, details?: string): void {
	toast.error(message, {
		description: details,
		duration: 4000,
	});
}
