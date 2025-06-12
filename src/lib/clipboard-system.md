# Clipboard System Documentation

This clipboard system provides a comprehensive set of tools for implementing copy-to-clipboard functionality in your Next.js application.

## Features

- ✅ Modern Clipboard API with automatic fallback
- ✅ Visual feedback with loading and success states
- ✅ Customizable components for different use cases
- ✅ TypeScript support with full type safety
- ✅ Accessible with proper ARIA labels
- ✅ Beautiful UI with Tailwind CSS

## Installation

All components are already set up in the project. To use them, simply import from the appropriate paths:

```typescript
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"
import { CopyButton } from "@/components/ui/copy-button"
import { CopyText, CopyCode, CopyId } from "@/components/ui/copy-text"
import { CodeBlock, InlineCode } from "@/components/ui/code-block"
```

## Basic Usage

### Using the Hook

```typescript
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"

function MyComponent() {
  const { copy, isCopied, isLoading, error } = useCopyToClipboard({
    timeout: 2000, // Duration to show "copied" state
    onSuccess: (text) => console.log(`Copied: ${text}`),
    onError: (error) => console.error("Copy failed:", error)
  })

  return (
    <button onClick={() => copy("Hello, World!")}>
      {isCopied ? "Copied!" : "Copy"}
    </button>
  )
}
```

### Using Components

#### CopyButton

A button component with built-in copy functionality:

```tsx
<CopyButton text="Copy this text" />
<CopyButton text="Copy with label" showLabel />
<CopyButton text="Custom variant" variant="outline" />
```

#### CopyText

Display text with an inline copy button:

```tsx
<CopyText text="user@example.com" />
<CopyCode text="npm install package" />
<CopyId text="550e8400-e29b-41d4-a716-446655440000" />
```

#### CodeBlock

Display code with syntax highlighting and copy functionality:

```tsx
<CodeBlock
  code={codeString}
  language="typescript"
  title="example.ts"
  showLineNumbers
/>
```

#### InlineCode

Inline code elements with optional copy functionality:

```tsx
<InlineCode>npm install</InlineCode>
<InlineCode copyable>npm install lucide-react</InlineCode>
```

## API Reference

### useCopyToClipboard Hook

```typescript
interface UseCopyToClipboardOptions {
  timeout?: number        // Duration for "copied" state (default: 2000ms)
  onSuccess?: (text: string) => void
  onError?: (error: Error) => void
}

interface UseCopyToClipboardReturn {
  copy: (text: string) => Promise<void>
  isCopied: boolean      // Whether text was recently copied
  isLoading: boolean     // Whether copy operation is in progress
  error: Error | null    // Error from last copy operation
  isSupported: boolean   // Whether browser supports Clipboard API
}
```

### Component Props

#### CopyButton
- `text: string` - Text to copy
- `label?: string` - Button label (default: "Copy")
- `copiedLabel?: string` - Label when copied (default: "Copied!")
- `showLabel?: boolean` - Show label with icon
- `timeout?: number` - Duration for copied state
- `variant?: ButtonVariant` - Button style variant
- `size?: ButtonSize` - Button size

#### CopyText
- `text: string` - Text to display and copy
- `truncate?: boolean` - Whether to truncate long text
- `maxWidth?: string` - Maximum width before truncation
- `showOnHover?: boolean` - Show copy button on hover only
- `renderText?: (text: string) => ReactNode` - Custom text renderer

#### CodeBlock
- `code: string` - Code to display
- `language?: string` - Programming language for syntax
- `showLineNumbers?: boolean` - Show line numbers
- `title?: string` - Title or filename to display
- `wrapLines?: boolean` - Whether to wrap long lines

## Browser Compatibility

The system uses the modern Clipboard API (`navigator.clipboard.writeText()`) with automatic fallback to `document.execCommand('copy')` for older browsers.

### Supported Browsers
- Chrome/Edge 63+
- Firefox 53+
- Safari 13.1+
- Opera 50+

### Fallback Support
- Internet Explorer 11
- Older versions of modern browsers

## Examples

### Custom Copy Component

```typescript
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

function ShareButton({ url }: { url: string }) {
  const { copy, isCopied } = useCopyToClipboard({
    onSuccess: () => toast.success("Link copied to clipboard!"),
    onError: () => toast.error("Failed to copy link")
  })

  return (
    <Button
      onClick={() => copy(url)}
      variant={isCopied ? "secondary" : "default"}
    >
      {isCopied ? "Link Copied!" : "Share Link"}
    </Button>
  )
}
```

### Copy on Click Text

```typescript
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"

function ClickToCopy({ children, text }: { children: ReactNode, text: string }) {
  const { copy, isCopied } = useCopyToClipboard({ timeout: 1000 })

  return (
    <span
      onClick={() => copy(text)}
      className="cursor-pointer hover:underline"
      title="Click to copy"
    >
      {children}
      {isCopied && <span className="ml-2 text-green-600">✓</span>}
    </span>
  )
}
```

## Best Practices

1. **Provide Visual Feedback**: Always show when text has been copied
2. **Handle Errors**: Use the error callback to inform users when copying fails
3. **Accessibility**: Include proper ARIA labels for screen readers
4. **Timeout Duration**: 2 seconds is typically optimal for the "copied" state
5. **Progressive Enhancement**: The fallback ensures functionality in all browsers

## Demo

Visit `/demo/clipboard` to see all components in action with live examples.

## MessageDisplay.tsx Integration

The clipboard system has been integrated into the `MessageDisplay.tsx` component to provide easy copying of chat messages and component references.

### Copy Message Content

Each message in the chat now has a copy button that appears on hover:

```tsx
// The MessageDisplay component automatically adds a copy button for each message
<MessageDisplay message={message} userName={userName} />
```

The copy button:
- Appears on hover over the message
- Copies the full message content (`message.body`)
- Shows visual feedback when copied
- Positioned at the top-right of the message

### Copy Component References

To easily copy references to `@MessageDisplay.tsx`:

```tsx
import { CopyComponentReference, CopyFileReference, FileMention } from "@/components/ui/copy-file-reference"

// Copy as @MessageDisplay.tsx
<CopyComponentReference name="MessageDisplay" />

// Copy full file path
<CopyFileReference path="src/components/chat/MessageDisplay.tsx" />

// Inline mention with copy on click
<FileMention path="MessageDisplay.tsx" />
```

### Common Use Cases

1. **Reference in Documentation**:
   ```tsx
   <p>See <FileMention path="MessageDisplay.tsx" /> for the implementation.</p>
   ```

2. **Copy Import Statement**:
   ```tsx
   <CopyButton text="import { MessageDisplay } from '@/components/chat/MessageDisplay'" />
   ```

3. **Copy Multiple References**:
   ```tsx
   <CopyButton
     text={`@MessageDisplay.tsx\nsrc/components/chat/MessageDisplay.tsx`}
     label="Copy All References"
   />
   ```

### Example Component

See `src/components/chat/message-display-example.tsx` for a complete example of all the ways to copy MessageDisplay.tsx references.
