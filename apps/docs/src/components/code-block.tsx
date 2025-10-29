"use client";

import { cn } from "@repo/ui/lib/utils";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ children, language = "typescript", className, showLineNumbers = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const languageColors: Record<string, string> = {
    typescript: "text-blue-400",
    javascript: "text-yellow-400",
    python: "text-green-400",
    bash: "text-purple-400",
    json: "text-orange-400",
    go: "text-cyan-400",
    dockerfile: "text-pink-400",
  };

  const lines = children.split('\n');

  return (
    <div className={cn("relative group my-4", className)}>
      <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
        {language && (
          <span className={cn("text-xs font-medium opacity-60", languageColors[language.toLowerCase()] || "text-muted-foreground")}>
            {language}
          </span>
        )}
        <button
          onClick={copyToClipboard}
          className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="rounded-lg border border-border bg-muted/30 dark:bg-muted/10 p-4 pr-12 overflow-x-auto">
        <code className="text-xs font-mono text-foreground">
          {showLineNumbers ? (
            <div className="flex">
              <div className="flex flex-col text-muted-foreground mr-4 select-none">
                {lines.map((_, i) => (
                  <span key={i} className="text-right">
                    {i + 1}
                  </span>
                ))}
              </div>
              <div className="flex-1">
                {children}
              </div>
            </div>
          ) : (
            children
          )}
        </code>
      </pre>
    </div>
  );
}