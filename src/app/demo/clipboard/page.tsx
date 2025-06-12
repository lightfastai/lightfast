"use client"

import { CopyButton } from "@/components/ui/copy-button"
import { CopyText, CopyCode, CopyId } from "@/components/ui/copy-text"
import { CodeBlock, InlineCode } from "@/components/ui/code-block"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function ClipboardDemoPage() {
  const sampleCode = `import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"

export function MyComponent() {
  const { copy, isCopied } = useCopyToClipboard()

  return (
    <button onClick={() => copy("Hello, World!")}>
      {isCopied ? "Copied!" : "Copy"}
    </button>
  )
}`

  const sampleJson = `{
  "name": "clipboard-demo",
  "version": "1.0.0",
  "features": [
    "copy-to-clipboard",
    "visual-feedback",
    "fallback-support"
  ]
}`

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Clipboard System Demo</h1>
        <p className="text-lg text-muted-foreground">
          Explore the copy-to-clipboard functionality with various components
          and use cases.
        </p>
      </div>

      <Separator />

      {/* Copy Button Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Copy Button Variants</CardTitle>
          <CardDescription>
            Different styles and configurations of the copy button component.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <CopyButton text="Hello, World!" />
              <span className="text-sm text-muted-foreground">
                Default button
              </span>
            </div>

            <div className="flex items-center gap-4">
              <CopyButton text="Copy this text" showLabel />
              <span className="text-sm text-muted-foreground">
                Button with label
              </span>
            </div>

            <div className="flex items-center gap-4">
              <CopyButton
                text="Custom labels"
                showLabel
                label="Copy to clipboard"
                copiedLabel="Successfully copied!"
              />
              <span className="text-sm text-muted-foreground">
                Custom labels
              </span>
            </div>

            <div className="flex items-center gap-4">
              <CopyButton text="Primary variant" variant="default" />
              <CopyButton text="Secondary variant" variant="secondary" />
              <CopyButton text="Outline variant" variant="outline" />
              <CopyButton text="Destructive variant" variant="destructive" />
            </div>

            <div className="flex items-center gap-4">
              <CopyButton text="Small size" size="sm" showLabel />
              <CopyButton text="Default size" size="default" showLabel />
              <CopyButton text="Large size" size="lg" showLabel />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Copy Text Components */}
      <Card>
        <CardHeader>
          <CardTitle>Copy Text Components</CardTitle>
          <CardDescription>
            Text elements with integrated copy functionality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Basic copyable text:</p>
              <CopyText text="user@example.com" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Copyable code snippet:</p>
              <CopyCode text="npm install @/components/ui/copy-button" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Copyable ID with truncation:
              </p>
              <CopyId text="550e8400-e29b-41d4-a716-446655440000" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Always visible copy button:</p>
              <CopyText text="Always visible button" showOnHover={false} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Custom max width:</p>
              <CopyText
                text="This is a very long text that will be truncated based on the max width setting"
                maxWidth="300px"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code Blocks */}
      <Card>
        <CardHeader>
          <CardTitle>Code Blocks</CardTitle>
          <CardDescription>
            Code blocks with syntax highlighting and copy functionality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Basic code block:</p>
              <CodeBlock code={sampleCode} language="typescript" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Code block with title:</p>
              <CodeBlock
                code={sampleCode}
                language="typescript"
                title="MyComponent.tsx"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Code block with line numbers:
              </p>
              <CodeBlock
                code={sampleJson}
                language="json"
                title="package.json"
                showLineNumbers
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Code block with wrapped lines:
              </p>
              <CodeBlock
                code="const veryLongLine = 'This is a very long line of code that would normally overflow the container but with wrapLines enabled it will wrap to the next line instead of creating a horizontal scrollbar';"
                language="javascript"
                wrapLines
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inline Code */}
      <Card>
        <CardHeader>
          <CardTitle>Inline Code</CardTitle>
          <CardDescription>
            Inline code elements with optional copy functionality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Install the package using{" "}
            <InlineCode>npm install lucide-react</InlineCode> or{" "}
            <InlineCode copyable>pnpm add lucide-react</InlineCode> (hover to
            copy).
          </p>

          <p>
            Import the hook:{" "}
            <InlineCode copyable>
              import {useCopyToClipboard} from "@/lib/use-copy-to-clipboard"
            </InlineCode>
          </p>

          <p>
            The component accepts a <InlineCode>text</InlineCode> prop and
            optional <InlineCode>timeout</InlineCode> configuration.
          </p>
        </CardContent>
      </Card>

      {/* Advanced Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Usage</CardTitle>
          <CardDescription>
            Using the copy hook directly for custom implementations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock
            code={`import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"

function CustomCopyComponent() {
  const { copy, isCopied, isLoading, error, isSupported } = useCopyToClipboard({
    timeout: 3000,
    onSuccess: (text) => {
      console.log(\`Copied: \${text}\`)
      // Show toast notification
    },
    onError: (error) => {
      console.error("Copy failed:", error)
      // Show error message
    }
  })

  if (!isSupported) {
    return <p>Clipboard API not supported</p>
  }

  return (
    <div>
      <button
        onClick={() => copy("Custom text")}
        disabled={isLoading}
      >
        {isLoading ? "Copying..." : isCopied ? "Copied!" : "Copy"}
      </button>
      {error && <p className="text-red-500">{error.message}</p>}
    </div>
  )
}`}
            language="typescript"
            title="CustomCopyComponent.tsx"
            showLineNumbers
          />
        </CardContent>
      </Card>

      {/* API Reference */}
      <Card>
        <CardHeader>
          <CardTitle>API Reference</CardTitle>
          <CardDescription>
            Quick reference for the clipboard system components and hooks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                useCopyToClipboard Hook
              </h3>
              <CodeBlock
                code={`interface UseCopyToClipboardOptions {
  timeout?: number        // Duration to show "copied" state (default: 2000ms)
  onSuccess?: (text: string) => void
  onError?: (error: Error) => void
}

interface UseCopyToClipboardReturn {
  copy: (text: string) => Promise<void>
  isCopied: boolean      // Whether text was recently copied
  isLoading: boolean     // Whether copy operation is in progress
  error: Error | null    // Error from last copy operation
  isSupported: boolean   // Whether browser supports Clipboard API
}`}
                language="typescript"
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">CopyButton Props</h3>
              <CodeBlock
                code={`interface CopyButtonProps {
  text: string           // Text to copy
  label?: string         // Button label (default: "Copy")
  copiedLabel?: string   // Label when copied (default: "Copied!")
  showLabel?: boolean    // Show label with icon (default: false)
  timeout?: number       // Duration for copied state (default: 2000ms)
  variant?: ButtonVariant
  size?: ButtonSize
  // ... other button props
}`}
                language="typescript"
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">
                Browser Compatibility
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                The clipboard system uses the modern Clipboard API with
                automatic fallback to the legacy execCommand method for older
                browsers.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Modern browsers:</span>
                  <InlineCode copyable>
                    navigator.clipboard.writeText()
                  </InlineCode>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Fallback method:</span>
                  <InlineCode copyable>document.execCommand('copy')</InlineCode>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
