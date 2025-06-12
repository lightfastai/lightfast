"use client"

import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"
import { cn } from "@/lib/utils"
import { CheckIcon, ClipboardIcon, LoaderIcon } from "lucide-react"
import type * as React from "react"

type ButtonProps = React.ComponentProps<typeof Button>

export interface CopyButtonProps extends Omit<ButtonProps, "onClick"> {
  /**
   * The text to copy to clipboard
   */
  text: string
  /**
   * Custom label for the button
   * @default "Copy"
   */
  label?: string
  /**
   * Custom label when text is copied
   * @default "Copied!"
   */
  copiedLabel?: string
  /**
   * Show label text alongside icon
   * @default false
   */
  showLabel?: boolean
  /**
   * Duration to show copied state in milliseconds
   * @default 2000
   */
  timeout?: number
  /**
   * Callback when copy succeeds
   */
  onCopySuccess?: (text: string) => void
  /**
   * Callback when copy fails
   */
  onCopyError?: (error: Error) => void
}

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied!",
  showLabel = false,
  timeout = 2000,
  onCopySuccess,
  onCopyError,
  className,
  variant = "ghost",
  size = "icon",
  disabled,
  ...props
}: CopyButtonProps) {
  const { copy, isCopied, isLoading, error } = useCopyToClipboard({
    timeout,
    onSuccess: onCopySuccess,
    onError: onCopyError,
  })

  const handleClick = async () => {
    await copy(text)
  }

  const displaySize = showLabel && size === "icon" ? "sm" : size

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isLoading}
      variant={variant}
      size={displaySize}
      className={cn(
        "relative transition-all",
        isCopied && "text-green-600 dark:text-green-400",
        className,
      )}
      aria-label={isCopied ? copiedLabel : label}
      {...props}
    >
      {isLoading ? (
        <LoaderIcon className={cn("animate-spin", showLabel && "mr-2")} />
      ) : isCopied ? (
        <CheckIcon className={cn("size-4", showLabel && "mr-2")} />
      ) : (
        <ClipboardIcon className={cn("size-4", showLabel && "mr-2")} />
      )}
      {showLabel && (
        <span className="text-xs">{isCopied ? copiedLabel : label}</span>
      )}
    </Button>
  )
}

/**
 * Inline copy button for use within text or code blocks
 */
export function InlineCopyButton({
  text,
  className,
  ...props
}: Omit<CopyButtonProps, "showLabel" | "size" | "variant">) {
  return (
    <CopyButton
      text={text}
      size="icon"
      variant="ghost"
      className={cn("h-6 w-6 p-1", className)}
      {...props}
    />
  )
}
