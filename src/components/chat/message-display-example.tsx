"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CopyComponentReference,
  CopyFileReference,
  FileMention,
} from "@/components/ui/copy-file-reference"
import { CopyButton } from "@/components/ui/copy-button"
import { CodeBlock } from "@/components/ui/code-block"

export function MessageDisplayCopyExample() {
  // Example import statement
  const importStatement = `import { MessageDisplay } from "@/components/chat/MessageDisplay"`

  // Full file path
  const fullPath = "src/components/chat/MessageDisplay.tsx"

  // Component usage example
  const usageExample = `<MessageDisplay
  message={message}
  userName={currentUser.name}
/>`

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Copying @MessageDisplay.tsx</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick References */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Quick Copy Options:</h3>

          <div className="flex flex-wrap gap-2">
            {/* Component reference with @ symbol */}
            <CopyComponentReference name="MessageDisplay" />

            {/* Full file path */}
            <CopyFileReference path={fullPath} />

            {/* Just the filename */}
            <CopyFileReference path="MessageDisplay.tsx" showAtSymbol={false} />
          </div>
        </div>

        {/* Import Statement */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Copy Import Statement:</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm">
              {importStatement}
            </code>
            <CopyButton text={importStatement} size="sm" variant="outline" />
          </div>
        </div>

        {/* Usage Example */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Copy Usage Example:</h3>
          <CodeBlock code={usageExample} language="tsx" title="Example Usage" />
        </div>

        {/* In Documentation */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">In Documentation/Chat:</h3>
          <p className="text-sm text-muted-foreground">
            The <FileMention path="MessageDisplay.tsx" /> component is located
            at{" "}
            <CopyFileReference
              path={fullPath}
              showIcon={false}
              className="inline-flex"
            />{" "}
            and handles rendering chat messages with support for streaming.
          </p>
        </div>

        {/* Copy Multiple References */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Copy All References:</h3>
          <CopyButton
            text={`@MessageDisplay.tsx
${fullPath}
${importStatement}`}
            showLabel
            label="Copy All References"
            variant="secondary"
            className="w-full"
          />
        </div>
      </CardContent>
    </Card>
  )
}
