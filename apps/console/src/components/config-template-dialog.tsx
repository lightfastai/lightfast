"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Copy, Check } from "lucide-react";

const CONFIG_TEMPLATE = `version: 1
include:
  - "**/*.md"
  - "**/*.mdx"
  - "docs/**/*"
`;

interface ConfigTemplateDialogProps {
  children: React.ReactNode;
}

/**
 * Config Template Dialog
 * Shows the lightfast.yml configuration template with copy functionality
 */
export function ConfigTemplateDialog({ children }: ConfigTemplateDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(CONFIG_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>lightfast.yml Configuration</DialogTitle>
          <DialogDescription>
            Add this file to your repository root to start indexing.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <pre className="p-4 rounded-md bg-muted text-sm overflow-x-auto font-mono">
            {CONFIG_TEMPLATE}
          </pre>
          <Button
            size="sm"
            variant="outline"
            className="absolute top-2 right-2"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>version</strong>: Always set to 1</p>
          <p><strong>include</strong>: Glob patterns for files to index</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
