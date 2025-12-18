"use client";

import { useState, useRef, useEffect } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface SSRCodeBlockCopyButtonProps {
  code: string;
  className?: string;
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

  useEffect(() => {
    return () => {
      window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        "transition-colors hover:bg-muted focus-visible:outline-none",
        "focus-visible:ring-1 focus-visible:ring-ring h-6 w-6",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      aria-label="Copy code"
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
