"use client";

import { cn } from "@repo/ui/lib/utils";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SSRCodeBlockCopyButtonProps {
  className?: string;
  code: string;
}

export function SSRCodeBlockCopyButton({
  code,
  className,
}: SSRCodeBlockCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number>(0);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    []
  );

  return (
    <button
      aria-label="Copy code"
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        "transition-colors hover:bg-muted focus-visible:outline-none",
        "h-6 w-6 focus-visible:ring-1 focus-visible:ring-ring",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
