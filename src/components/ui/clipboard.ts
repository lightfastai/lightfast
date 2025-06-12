// Export all clipboard-related components and utilities

export {
  useCopyToClipboard,
  copyToClipboard,
  fallbackCopyToClipboard,
} from "@/lib/use-copy-to-clipboard"
export type {
  UseCopyToClipboardOptions,
  UseCopyToClipboardReturn,
} from "@/lib/use-copy-to-clipboard"

export { CopyButton, InlineCopyButton } from "./copy-button"
export type { CopyButtonProps } from "./copy-button"

export { CopyText, CopyCode, CopyId } from "./copy-text"
export type { CopyTextProps } from "./copy-text"

export { CodeBlock, InlineCode } from "./code-block"
export type { CodeBlockProps } from "./code-block"

export {
  CopyFileReference,
  CopyComponentReference,
  FileMention,
} from "./copy-file-reference"
export type { CopyFileReferenceProps } from "./copy-file-reference"
