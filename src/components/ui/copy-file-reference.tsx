"use client"

import { CopyText } from "@/components/ui/copy-text"
import { FileIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CopyFileReferenceProps {
  /**
   * The file path or name to display and copy
   */
  path: string
  /**
   * Whether to show the @ symbol prefix
   * @default true
   */
  showAtSymbol?: boolean
  /**
   * Custom className for styling
   */
  className?: string
  /**
   * Whether to show the file icon
   * @default true
   */
  showIcon?: boolean
}

export function CopyFileReference({
  path,
  showAtSymbol = true,
  className,
  showIcon = true,
}: CopyFileReferenceProps) {
  const displayText = showAtSymbol ? `@${path}` : path
  const copyText = showAtSymbol ? `@${path}` : path

  return (
    <CopyText
      text={copyText}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors font-mono text-sm",
        className,
      )}
      showOnHover={false}
      truncate={false}
    >
      {showIcon && <FileIcon className="h-3 w-3 text-muted-foreground" />}
      <span className="text-muted-foreground">{displayText}</span>
    </CopyText>
  )
}

/**
 * Pre-configured component for component file references
 */
export function CopyComponentReference({
  name,
  ...props
}: Omit<CopyFileReferenceProps, "path"> & { name: string }) {
  return <CopyFileReference path={`${name}.tsx`} {...props} />
}

/**
 * Inline mention of a file with copy functionality
 */
export function FileMention({
  path,
  className,
}: {
  path: string
  className?: string
}) {
  return (
    <CopyText
      text={`@${path}`}
      className={cn(
        "inline-flex items-center gap-0.5 text-primary hover:underline cursor-pointer",
        className,
      )}
      showOnHover
      truncate={false}
    >
      <span className="font-medium">@{path}</span>
    </CopyText>
  )
}
