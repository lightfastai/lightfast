"use client"

import { cn } from "@/lib/utils"
import { InlineCopyButton } from "@/components/ui/copy-button"
import type * as React from "react"

export interface CopyTextProps extends React.ComponentProps<"div"> {
  /**
   * The text to display and copy
   */
  text: string
  /**
   * Whether to truncate long text
   * @default true
   */
  truncate?: boolean
  /**
   * Maximum width before truncation
   * @default "200px"
   */
  maxWidth?: string
  /**
   * Show copy button on hover only
   * @default true
   */
  showOnHover?: boolean
  /**
   * Custom render function for the text
   */
  renderText?: (text: string) => React.ReactNode
}

export function CopyText({
  text,
  truncate = true,
  maxWidth = "200px",
  showOnHover = true,
  renderText,
  className,
  children,
  ...props
}: CopyTextProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 group/copy-text",
        className,
      )}
      {...props}
    >
      <span
        className={cn("text-sm font-mono", truncate && "truncate block")}
        style={truncate ? { maxWidth } : undefined}
        title={text}
      >
        {renderText ? renderText(text) : children || text}
      </span>
      <InlineCopyButton
        text={text}
        className={cn(
          "opacity-0 transition-opacity",
          showOnHover && "group-hover/copy-text:opacity-100",
          !showOnHover && "opacity-100",
        )}
      />
    </div>
  )
}

/**
 * Pre-styled copyable text variants
 */

export function CopyCode({
  text,
  className,
  ...props
}: Omit<CopyTextProps, "renderText">) {
  return (
    <CopyText
      text={text}
      className={cn(
        "bg-muted/50 dark:bg-muted/20 border border-border rounded px-2 py-1",
        className,
      )}
      {...props}
    />
  )
}

export function CopyId({
  text,
  className,
  ...props
}: Omit<CopyTextProps, "renderText" | "truncate">) {
  return (
    <CopyText
      text={text}
      truncate
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}
