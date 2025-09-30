export const MAX_ATTACHMENT_COUNT = 4;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB per file

export const IMAGE_MIME_PREFIX = "image/";
export const PDF_MIME_TYPE = "application/pdf";

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "heic",
  "pdf",
] as const;
