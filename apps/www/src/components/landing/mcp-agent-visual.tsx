/**
 * MCP Agent Visual Component
 *
 * Showcases MCP tools for autonomous agent workflows.
 * Displays agent using Lightfast tools with real-time execution.
 * Designed to be used inside VisualShowcase.
 */

export function McpAgentVisual() {
  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="relative z-10 flex h-full flex-col gap-3 rounded-md bg-background p-3">
        {/* Agent Query Display */}
        <div className="bg-secondary rounded-md px-3 py-4 font-mono text-sm">
          <div className="text-muted-foreground">
            <span className="text-primary">agent</span>
            <span className="text-muted-foreground">.</span>
            <span className="text-foreground">query</span>
            <span className="text-muted-foreground">(</span>
          </div>
          <div className="pl-4 text-foreground">
            &quot;Find all PRs related to authentication changes&quot;
          </div>
          <div className="text-muted-foreground">)</div>
        </div>

        {/* Agent Execution Steps */}
        <div className="flex-1 bg-accent rounded-md overflow-hidden">
          <div className="space-y-2 p-3">
            {/* Tool Call 1 */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Tool Call
                </span>
              </div>
              <div className="font-mono text-sm">
                <span className="text-primary">lightfast_search</span>
                <span className="text-muted-foreground">(</span>
                <span className="text-foreground">
                  &quot;authentication changes&quot;
                </span>
                <span className="text-muted-foreground">)</span>
              </div>
            </div>

            {/* Results 1 */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Results
                </span>
                <span className="text-xs text-muted-foreground">
                  12 matches
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-primary">→</span>
                  <span className="text-foreground">
                    PR #1289: Add Clerk integration
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-primary">→</span>
                  <span className="text-foreground">
                    PR #1156: Refactor auth middleware
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-primary">→</span>
                  <span className="text-foreground">
                    PR #1092: Fix session persistence
                  </span>
                </div>
              </div>
            </div>

            {/* Tool Call 2 */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Tool Call
                </span>
              </div>
              <div className="font-mono text-sm">
                <span className="text-primary">lightfast_contents</span>
                <span className="text-muted-foreground">(</span>
                <span className="text-foreground">&quot;PR #1289&quot;</span>
                <span className="text-muted-foreground">)</span>
              </div>
            </div>

            {/* Results 2 */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Contents
                </span>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Author: @sarah-chen</div>
                <div>Reviewers: @marcus, @priya</div>
                <div>Status: Merged 3 days ago</div>
              </div>
            </div>

            {/* Response */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  Response
                </span>
              </div>
              <p className="text-sm text-foreground">
                Found 12 PRs. The most recent is PR #1289 by Sarah Chen, which
                adds Clerk integration. It was reviewed by Marcus and Priya,
                merged 3 days ago.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
