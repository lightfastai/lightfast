"use client"

import { cn } from "@/lib/utils"
import { CopyButton } from "@/components/ui/copy-button"
import type * as React from "react"

export interface CodeBlockProps extends React.ComponentProps<"div"> {
  /**
   * The code to display
   */
  code: string
  /**
   * Programming language for syntax highlighting
   */
  language?: string
  /**
   * Show line numbers
   * @default false
   */
  showLineNumbers?: boolean
  /**
   * Title or filename to display
   */
  title?: string
  /**
   * Whether to wrap long lines
   * @default false
   */
  wrapLines?: boolean
}

export function CodeBlock({
  code,
  language,
  showLineNumbers = false,
  title,
  wrapLines = false,
  className,
  ...props
}: CodeBlockProps) {
  const lines = code.split("\n")
  const lineNumberWidth = String(lines.length).length

  return (
    <div
      className={cn(
        "relative group rounded-lg border bg-muted/50 dark:bg-muted/20",
        className,
      )}
      {...props}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="text-sm font-medium text-muted-foreground">
            {title}
          </span>
          {language && (
            <span className="text-xs text-muted-foreground">{language}</span>
          )}
        </div>
      )}

      <div className="relative">
        <pre
          className={cn(
            "p-4 overflow-x-auto text-sm",
            wrapLines && "whitespace-pre-wrap",
            !wrapLines && "whitespace-pre",
            title && "pt-3",
          )}
        >
          {showLineNumbers ? (
            <code className="relative block">
              {lines.map((line, index) => (
                <div
                  key={`line-${index}-${line.slice(0, 10)}`}
                  className="table-row"
                >
                  <span
                    className="table-cell pr-4 text-muted-foreground text-right select-none"
                    style={{ minWidth: `${lineNumberWidth + 1}ch` }}
                  >
                    {index + 1}
                  </span>
                  <span className="table-cell">{line || "\n"}</span>
                </div>
              ))}
            </code>
          ) : (
            <code>{code}</code>
          )}
        </pre>

        <CopyButton
          text={code}
          className={cn(
            "absolute top-2 right-2",
            "opacity-0 transition-opacity group-hover:opacity-100",
            "bg-background/80 backdrop-blur-sm",
          )}
          size="icon"
          variant="ghost"
        />
      </div>
    </div>
  )
}

/**
 * Inline code component with optional copy functionality
 */
export function InlineCode({
  children,
  copyable = false,
  className,
  ...props
}: React.ComponentProps<"code"> & {
  copyable?: boolean
}) {
  const text = typeof children === "string" ? children : ""

  if (copyable && text) {
    return (
      <span className="relative inline-flex items-center gap-1 group/inline-code">
        <code
          className={cn(
            "px-1.5 py-0.5 rounded bg-muted/50 dark:bg-muted/20 text-sm font-mono",
            className,
          )}
          {...props}
        >
          {children}
        </code>
        <CopyButton
          text={text}
          className="opacity-0 group-hover/inline-code:opacity-100 transition-opacity h-5 w-5 p-0.5"
          size="icon"
          variant="ghost"
        />
      </span>
    )
  }

  return (
    <code
      className={cn(
        "px-1.5 py-0.5 rounded bg-muted/50 dark:bg-muted/20 text-sm font-mono",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  )
}
