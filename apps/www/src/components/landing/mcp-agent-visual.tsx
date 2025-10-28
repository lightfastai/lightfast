/**
 * MCP Agent Visual Component
 *
 * Showcases MCP tools for autonomous agent workflows.
 * Displays agent using Lightfast tools with real-time execution.
 */

import Image from "next/image";

export function McpAgentVisual() {
  const agentSteps = [
    {
      role: "user",
      content:
        "Find all PRs related to authentication changes in the last month",
    },
    {
      role: "assistant",
      thought: "I'll use lightfast.search to find relevant PRs",
      tool: "lightfast_search",
      args: {
        query: "authentication changes",
        filters: {
          source: "github",
          type: "pull_request",
          timeframe: "1m",
        },
      },
    },
    {
      role: "tool",
      name: "lightfast_search",
      result: "Found 12 PRs",
      citations: [
        "PR #1289: Add Clerk integration",
        "PR #1156: Refactor auth middleware",
        "PR #1092: Fix session persistence",
      ],
    },
    {
      role: "assistant",
      content:
        "I found 12 PRs related to authentication in the last month. Key changes include...",
    },
  ];

  return (
    <div className="h-full flex flex-col relative px-16 py-24">
      <div className="absolute inset-0 p-4">
        <div className="relative w-full h-full rounded-sm overflow-hidden">
          <Image
            src="/images/playground-placeholder-2.webp"
            alt="Background"
            fill
            className="object-cover"
            priority
            unoptimized
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 bg-background p-3 rounded-md h-full relative z-10 overflow-hidden">
        {/* Agent Chat Interface */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {agentSteps.map((step, index) => (
            <div key={index}>
              {step.role === "user" && (
                <div className="bg-secondary rounded-md px-4 py-3">
                  <p className="text-sm text-foreground">{step.content}</p>
                </div>
              )}

              {step.role === "assistant" && step.thought && (
                <div className="bg-card rounded-md px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      AGENT
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    {step.thought}
                  </p>
                  {step.tool && (
                    <div className="mt-2 font-mono text-xs">
                      <div className="text-primary">{step.tool}</div>
                      <pre className="text-muted-foreground mt-1 overflow-x-auto">
                        {JSON.stringify(step.args, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {step.role === "tool" && (
                <div className="bg-secondary rounded-md px-4 py-3">
                  <p className="text-xs text-foreground">{step.result}</p>
                  {step.citations && (
                    <div className="mt-2 space-y-1">
                      {step.citations.map((citation, i) => (
                        <div
                          key={i}
                          className="text-xs text-muted-foreground flex items-center gap-2"
                        >
                          <span className="text-primary">→</span>
                          {citation}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step.role === "assistant" && step.content && (
                <div className="bg-secondary rounded-md px-4 py-3">
                  <p className="text-sm text-foreground">{step.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
