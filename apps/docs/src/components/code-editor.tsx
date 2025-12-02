"use client";

import React, { useState } from "react";
import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface CodeEditorProps {
  code?: string;
  language?: string;
  className?: string;
  showHeader?: boolean;
}

export function CodeEditor({
  code = `import Lightfast from "lightfast";
const client = new Lightfast();

const response = await client.agents.create({
  model: "gpt-5",
  input: "Write a short bedtime story about a unicorn.",
});

console.log(response.output_text);`,
  language = "javascript",
  className = "",
  showHeader = true,
}: CodeEditorProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "border border-transparent bg-card rounded-xs bg-card overflow-hidden shadow-sm",
        className,
      )}
    >
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {/* Code Content */}
      <div className="p-0 overflow-x-auto">
        <pre className="text-xs leading-4 m-0 min-w-max">
          <code className="block p-4 text-xs">
            {code.split("\n").map((line, index) => (
              <div
                key={index}
                className="flex min-h-[16px] text-xs whitespace-nowrap"
              >
                <span className="text-muted-foreground/50 select-none pr-4 text-right w-8 flex-shrink-0 text-xs">
                  {index + 1}
                </span>
                <span className="flex-1 text-xs">
                  {highlightLine(line, language)}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

// Simple syntax highlighting function that returns JSX
function highlightLine(line: string, language: string) {
  const tokens: ReactNode[] = [];
  let remaining = line;
  let key = 0;

  if (language === "yaml" || language === "yml") {
    // YAML syntax highlighting
    // Comments
    remaining = remaining.replace(/(#.*)$/g, (match) => {
      tokens.push(
        <span key={key++} className="text-muted-foreground/60">
          {match}
        </span>,
      );
      return `__TOKEN_${tokens.length - 1}__`;
    });

    // Keys (before colon)
    remaining = remaining.replace(
      /^(\s*)([a-zA-Z_-]+):/g,
      (match, spaces, keyName) => {
        tokens.push(
          <span key={key++}>
            {spaces}
            <span className="text-[#79c0ff]">{keyName}</span>:
          </span>,
        );
        return `__TOKEN_${tokens.length - 1}__`;
      },
    );

    // Strings
    remaining = remaining.replace(/"([^"]*)"/g, (match) => {
      tokens.push(
        <span key={key++} className="text-[#a5d6ff]">
          {match}
        </span>,
      );
      return `__TOKEN_${tokens.length - 1}__`;
    });

    // Numbers
    remaining = remaining.replace(/\b(\d+)\b/g, (match) => {
      tokens.push(
        <span key={key++} className="text-[#79c0ff]">
          {match}
        </span>,
      );
      return `__TOKEN_${tokens.length - 1}__`;
    });
  } else if (language === "bash" || language === "sh" || language === "shell") {
    // Bash syntax highlighting
    // Comments
    remaining = remaining.replace(/(#.*)$/g, (match) => {
      tokens.push(
        <span key={key++} className="text-muted-foreground/60">
          {match}
        </span>,
      );
      return `__TOKEN_${tokens.length - 1}__`;
    });

    // Commands - git, npm, pnpm, etc.
    remaining = remaining.replace(
      /\b(git|npm|pnpm|yarn|npx|cd|ls|mkdir|rm|mv|cp|cat|echo|export|source)\b/g,
      (match) => {
        tokens.push(
          <span key={key++} className="text-[#ff7b72]">
            {match}
          </span>,
        );
        return `__TOKEN_${tokens.length - 1}__`;
      },
    );

    // Flags and options (starting with - or --)
    remaining = remaining.replace(/\s(-{1,2}[a-zA-Z0-9-]+)/g, (match, flag) => {
      tokens.push(
        <span key={key++}>
          {match.replace(flag, "")}
          <span className="text-[#79c0ff]">{flag}</span>
        </span>,
      );
      return `__TOKEN_${tokens.length - 1}__`;
    });

    // Strings (single and double quotes)
    remaining = remaining.replace(/("[^"]*"|'[^']*')/g, (match) => {
      tokens.push(
        <span key={key++} className="text-[#a5d6ff]">
          {match}
        </span>,
      );
      return `__TOKEN_${tokens.length - 1}__`;
    });

    // File paths (ending in common extensions)
    remaining = remaining.replace(
      /\b([\w.-]+\.(yml|yaml|md|mdx|json|js|ts|tsx))\b/g,
      (match) => {
        tokens.push(
          <span key={key++} className="text-[#a5d6ff]">
            {match}
          </span>,
        );
        return `__TOKEN_${tokens.length - 1}__`;
      },
    );
  } else {
    // JavaScript syntax highlighting
    // Keywords - GitHub Dark theme pink/purple
    remaining = remaining.replace(
      /\b(import|const|await|new|from)\b/g,
      (match) => {
        tokens.push(
          <span key={key++} className="text-[#ff7b72]">
            {match}
          </span>,
        );
        return `__TOKEN_${tokens.length - 1}__`;
      },
    );

    // Variables - GitHub Dark theme blue
    remaining = remaining.replace(/\b(client|response|console)\b/g, (match) => {
      tokens.push(
        <span key={key++} className="text-[#79c0ff]">
          {match}
        </span>,
      );
      return `__TOKEN_${tokens.length - 1}__`;
    });

    // Strings - GitHub Dark theme green
    remaining = remaining.replace(/"([^"]*)"/g, (match) => {
      tokens.push(
        <span key={key++} className="text-[#a5d6ff]">
          {match}
        </span>,
      );
      return `__TOKEN_${tokens.length - 1}__`;
    });

    // Methods - GitHub Dark theme yellow/orange
    remaining = remaining.replace(/\b(log|create)\b/g, (match) => {
      tokens.push(
        <span key={key++} className="text-[#d2a8ff]">
          {match}
        </span>,
      );
      return `__TOKEN_${tokens.length - 1}__`;
    });
  }

  // Split by tokens and reconstruct
  const parts = remaining.split(/(__TOKEN_\d+__)/);
  return parts.map((part, _index) => {
    const tokenRegex = /^__TOKEN_(\d+)__$/;
    if (tokenRegex.test(part)) {
      const match = tokenRegex.exec(part);
      const tokenIndex = parseInt(match?.[1] ?? "0");
      return tokens[tokenIndex];
    }
    return part;
  });
}
