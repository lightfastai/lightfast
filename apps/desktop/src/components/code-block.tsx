// This component is no longer needed as we handle code rendering directly in mdx-components.tsx
// You can delete this file entirely after the changes are tested and working

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
  // In ReactMarkdown, the 'inline' prop is the definitive indicator:
  // - true: for inline code like `code`
  // - false/undefined: for code blocks like ```code```

  if (inline) {
    // This is inline code like `code` in markdown
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
  } else {
    // This is a code block like ```code``` in markdown
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
  }
}
