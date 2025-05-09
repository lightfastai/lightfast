"use client";

interface CodeBlockProps {
  node: any;
  inline: boolean;
  className: string;
  children: any;
}

export function CodeBlock({
  node,
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
          className={`border-border text-foreground dark:bg-background w-full overflow-x-auto rounded-xl border p-2 text-xs`}
        >
          <code className="break-words whitespace-pre-wrap">{children}</code>
        </pre>
      </div>
    );
  } else {
    return (
      <code
        className={`${className} bg-muted rounded-md px-1 py-0.5 text-xs`}
        {...props}
      >
        {children}
      </code>
    );
  }
}
