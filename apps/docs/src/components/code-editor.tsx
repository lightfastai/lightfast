"use client";

import React, { useState } from "react";
import type { ReactNode } from "react";
import { Copy } from "lucide-react";

const codeSnippet = `import Lightfast from "lightfast";
const client = new Lightfast();

const response = await client.agents.create({
  model: "gpt-5",
  input: "Write a short bedtime story about a unicorn.",
});

console.log(response.output_text);`;

export function CodeEditor() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          javascript
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy className="w-3 h-3" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-0 overflow-x-auto">
        <pre className="text-xs leading-4 m-0 min-w-max">
          <code className="block p-4 text-xs">
            {codeSnippet.split("\n").map((line, index) => (
              <div
                key={index}
                className="flex min-h-[16px] text-xs whitespace-nowrap"
              >
                <span className="text-muted-foreground/50 select-none pr-4 text-right w-8 flex-shrink-0 text-xs">
                  {index + 1}
                </span>
                <span className="flex-1 text-xs">{highlightLine(line)}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

// Simple syntax highlighting function that returns JSX
function highlightLine(line: string) {
  const tokens: ReactNode[] = [];
  let remaining = line;
  let key = 0;

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
