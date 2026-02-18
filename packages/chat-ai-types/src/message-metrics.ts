import type {
  LightfastAppChatUIMessage,
  LightfastAppChatUIMessagePart,
} from "./index";

export interface MessageCharMetrics {
  charCount: number;
  tokenCount?: number;
}

export interface MessagePreviewResult {
  parts: LightfastAppChatUIMessage["parts"];
  previewCharCount: number;
  truncated: boolean;
}

const PREFERRED_TEXT_KEYS = ["text", "content", "value"] as const;

function getPrimaryTextKey(part: LightfastAppChatUIMessagePart):
  | (typeof PREFERRED_TEXT_KEYS)[number]
  | null {
  for (const key of PREFERRED_TEXT_KEYS) {
    if (typeof (part as Record<string, unknown>)[key] === "string") {
      return key;
    }
  }
  return null;
}

function getPartDisplayString(part: LightfastAppChatUIMessagePart): string {
  const key = getPrimaryTextKey(part);
  if (key) {
    return String((part as Record<string, unknown>)[key]);
  }

  if (
    "type" in part &&
    typeof (part as { type: unknown }).type === "string"
  ) {
    const maybeString = (part as Record<string, unknown>).display;
    if (typeof maybeString === "string") {
      return maybeString;
    }
  }

  try {
    return JSON.stringify(part);
  } catch {
    return JSON.stringify(Object.entries(part as Record<string, unknown>));
  }
}

export function computeMessageCharCount(
  parts: LightfastAppChatUIMessage["parts"],
): MessageCharMetrics {
  let charCount = 0;
  for (const part of parts) {
    charCount += getPartDisplayString(part).length;
  }

  return {
    charCount,
  };
}

export function createPreviewParts(
  parts: LightfastAppChatUIMessage["parts"],
  limit: number,
): MessagePreviewResult {
  if (limit <= 0) {
    return {
      parts: [],
      previewCharCount: 0,
      truncated: parts.length > 0,
    };
  }

  const preview: LightfastAppChatUIMessage["parts"] = [];
  let used = 0;
  let truncated = false;

  for (const part of parts) {
    const textKey = getPrimaryTextKey(part);

    if (!textKey) {
      preview.push(part);
      continue;
    }

    if (used >= limit) {
      truncated = true;
      break;
    }

    const originalText = String((part as Record<string, unknown>)[textKey]);
    const originalLength = originalText.length;
    const remaining = limit - used;

    if (originalLength <= remaining) {
      preview.push(part);
      used += originalLength;
      continue;
    }

    const sliceLength = Math.max(remaining - 1, 0);
    const truncatedText =
      sliceLength > 0 ? `${originalText.slice(0, sliceLength)}…` : "";

    const cloned = {
      ...part,
      [textKey]: truncatedText,
    } as LightfastAppChatUIMessagePart;

    preview.push(cloned);
    used = limit;
    truncated = true;
    break;
  }

  if (!truncated && preview.length < parts.length) {
    truncated = true;
  }

  return {
    parts: preview,
    previewCharCount: used,
    truncated,
  };
}
