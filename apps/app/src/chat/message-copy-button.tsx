import {
  Tick02Icon as Check,
  Copy01Icon as Copy,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import type { UIMessage } from "@vendor/ai";
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
    <Button
      aria-label={label}
      className="size-7 rounded-full text-muted-foreground"
      onClick={() => void handleCopy()}
      size="icon"
      title={label}
      type="button"
      variant="ghost"
    >
      {copied ? (
        <HugeiconsIcon className="size-3.5" icon={Check} />
      ) : (
        <HugeiconsIcon className="size-3.5 opacity-50" icon={Copy} />
      )}
    </Button>
  );
}
