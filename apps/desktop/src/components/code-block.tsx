"use client";

import { cn } from "@repo/ui/lib/utils";

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children: any;
}

export function CodeBlock({
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) {
  if (!inline) {
    return (
      <div className="not-prose flex flex-col">
        <pre
          {...props}
          className={`border-border text-foreground dark:bg-muted/20 w-full overflow-x-auto rounded-md border p-2 text-xs ${className}`}
        >
          <code className="break-words whitespace-pre-wrap">{children}</code>
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
