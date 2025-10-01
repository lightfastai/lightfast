/**
 * Shared attachment constants and helpers for Lightfast chat.
 */
export const MAX_ATTACHMENT_COUNT = 4;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB per file

export const IMAGE_MIME_PREFIX = "image/";
export const PDF_MIME_TYPE = "application/pdf";

/**
 * Accept attribute values for file input elements
 */
export const IMAGE_ACCEPT = "image/*";
export const PDF_ACCEPT = "application/pdf";

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"heic",
	"pdf",
] as const;

export type AttachmentKind = "image" | "pdf" | "unknown";

const EXTENSION_LOOKUP = new Set<string>(ALLOWED_ATTACHMENT_EXTENSIONS);

export function inferAttachmentKind(
	mediaType?: string | null,
	filename?: string | null,
): AttachmentKind {
	if (mediaType?.startsWith(IMAGE_MIME_PREFIX)) {
		return "image";
	}
	if (mediaType === PDF_MIME_TYPE) {
		return "pdf";
	}

	const match = filename?.split(".").pop()?.toLowerCase();
	if (match) {
		if (match === "pdf") {
			return "pdf";
		}
		if (EXTENSION_LOOKUP.has(match) && match !== "pdf") {
			return "image";
		}
	}

	return "unknown";
}

const FILENAME_SANITIZE_REGEX = /[^a-zA-Z0-9_.-]+/g;

export function sanitizeAttachmentFilename(filename: string): string {
	const trimmed = filename.trim().replaceAll("\\", "/");
	const base = trimmed.split("/").pop() ?? "attachment";
	return base.replace(FILENAME_SANITIZE_REGEX, "-");
}

export function ensureAttachmentAllowed(
	kind: AttachmentKind,
	options: { allowImages: boolean; allowPdf: boolean },
): boolean {
	if (kind === "image") {
		return options.allowImages;
	}
	if (kind === "pdf") {
		return options.allowPdf;
	}
	return false;
}
