"use client";

import { MessageAction } from "@repo/ui/components/ai-elements/message";
import type { UIMessage } from "@vendor/ai";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function extractMessageText(message: UIMessage): string {
  const segments: string[] = [];
  for (const part of message.parts) {
    if (part.type === "text") {
      segments.push(part.text);
    }
  }
  return segments.join("\n\n").trim();
}

export function MessageCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (resetRef.current) {
        clearTimeout(resetRef.current);
      }
    },
    []
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    if (resetRef.current) {
      clearTimeout(resetRef.current);
    }
    resetRef.current = setTimeout(() => setCopied(false), 1500);
  };

  const label = copied ? "Copied" : "Copy";

  return (
    <MessageAction
      label={label}
      onClick={() => void handleCopy()}
      tooltip={label}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </MessageAction>
  );
}
