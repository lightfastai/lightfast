import { IMAGE_MIME_PREFIX, PDF_MIME_TYPE, ALLOWED_ATTACHMENT_EXTENSIONS } from "./constants";

export type AttachmentKind = "image" | "pdf" | "unknown";

const EXTENSION_LOOKUP = new Set(ALLOWED_ATTACHMENT_EXTENSIONS);

export function inferAttachmentKind(
  mediaType?: string | null,
  filename?: string | null,
): AttachmentKind {
  if (mediaType && mediaType.startsWith(IMAGE_MIME_PREFIX)) {
    return "image";
  }
  if (mediaType === PDF_MIME_TYPE) {
    return "pdf";
  }

  if (filename) {
    const match = filename.split(".").pop()?.toLowerCase();
    if (match) {
      if (match === "pdf") {
        return "pdf";
      }
      if (EXTENSION_LOOKUP.has(match) && match !== "pdf") {
        return "image";
      }
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
