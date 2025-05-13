"use client";

import React from "react";

import { cn } from "@repo/ui/lib/utils";

// Make the interface match what ReactMarkdown passes
interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function CodeBlock({
  inline = false,
  className = "",
  children,
  ...props
}: CodeBlockProps) {
  // Handle both explicit inline prop and className-based detection
  const isInline = inline === true;

  if (!isInline) {
    return (
      <div className="not-prose flex flex-col">
        <pre
          {...props}
          className={cn(
            "text-foreground dark:bg-muted/20 w-full overflow-x-auto rounded-md p-2 text-xs",
            className,
          )}
        >
          <code className="break-words">{children}</code>
        </pre>
      </div>
    );
  } else {
    return (
      <code
        className={cn(
          "not-prose",
          "bg-muted rounded-md px-1 py-0.5 text-xs",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  }
}
