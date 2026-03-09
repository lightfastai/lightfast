"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>lightfast.yml Configuration</DialogTitle>
          <DialogDescription>
            Add this file to your repository root to start indexing.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
            {CONFIG_TEMPLATE}
          </pre>
          <Button
            className="absolute top-2 right-2"
            onClick={handleCopy}
            size="sm"
            variant="outline"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="space-y-2 text-muted-foreground text-sm">
          <p>
            <strong>version</strong>: Always set to 1
          </p>
          <p>
            <strong>include</strong>: Glob patterns for files to index
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
