"use client";

export function ThreeCardShowcase() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <ContextCard />
        <TeamCard />
        <MultiAgentCard />
      </div>
    </div>
  );
}

// Card 1: Context Understanding (Network Graph Style)
function ContextCard() {
  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden flex flex-col h-[400px]">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="font-mono text-xs bg-muted text-foreground px-2 py-1 rounded">
            CONTEXT
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Deep Understanding
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Unified knowledge graph across your entire stack
        </p>
      </div>

      {/* Content - Network Graph */}
      <div className="flex-1 p-4 border border-border mx-4 mb-4 bg-muted/30 rounded-sm overflow-auto">
        <div className="relative h-full flex items-center justify-center isolate">
          {/* Connection Lines - Behind everything */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none -z-10"
            style={{ opacity: 0.3 }}
          >
            {/* Top Left to Center */}
            <line
              x1="16.67%"
              y1="16.67%"
              x2="50%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="1"
              className="text-muted-foreground"
            />
            {/* Top Right to Center */}
            <line
              x1="83.33%"
              y1="16.67%"
              x2="50%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="1"
              className="text-muted-foreground"
            />
            {/* Bottom Left to Center */}
            <line
              x1="16.67%"
              y1="83.33%"
              x2="50%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="1"
              className="text-muted-foreground"
            />
            {/* Bottom Right to Center */}
            <line
              x1="83.33%"
              y1="83.33%"
              x2="50%"
              y2="50%"
              stroke="currentColor"
              strokeWidth="1"
              className="text-muted-foreground"
            />
          </svg>

          {/* Center Node */}
          <div className="absolute z-10 relative">
            <div className="w-16 h-16 rounded-full border border-border bg-muted flex items-center justify-center" />
          </div>

          {/* Connected Nodes */}
          {/* Top Left */}
          <div className="absolute top-4 left-4 z-10">
            <div className="w-12 h-12 rounded-full border border-border bg-muted/30 flex items-center justify-center">
              <div className="text-[8px] font-mono text-foreground">Code</div>
            </div>
          </div>

          {/* Top Right */}
          <div className="absolute top-4 right-4 z-10">
            <div className="w-12 h-12 rounded-full border border-border bg-muted/30 flex items-center justify-center">
              <div className="text-[8px] font-mono text-foreground">Linear</div>
            </div>
          </div>

          {/* Bottom Left */}
          <div className="absolute bottom-4 left-4 z-10">
            <div className="w-12 h-12 rounded-full border border-border bg-muted/30 flex items-center justify-center">
              <div className="text-[8px] font-mono text-foreground">GitHub</div>
            </div>
          </div>

          {/* Bottom Right */}
          <div className="absolute bottom-4 right-4 z-10">
            <div className="w-12 h-12 rounded-full border border-border bg-muted/30 flex items-center justify-center">
              <div className="text-[8px] font-mono text-foreground">Notion</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Card 2: Team Orchestration (Grid Layout)
function TeamCard() {
  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden flex flex-col h-[400px]">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="font-mono text-xs bg-muted text-foreground px-2 py-1 rounded">
            TEAM
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Unblock Workflows
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Non-technical teammates execute technical workflows
        </p>
      </div>

      {/* Content - Grid Layout */}
      <div className="flex-1 p-4 border border-border mx-4 mb-4 bg-muted/30 rounded-sm overflow-auto">
        <div className="grid grid-cols-2 gap-3 h-full">
          {/* Before */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground">
              BEFORE
            </div>
            <div className="space-y-1.5">
              <div className="h-1 bg-muted rounded w-full" />
              <div className="h-1 bg-muted rounded w-4/5" />
              <div className="h-1 bg-muted rounded w-3/5" />
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              Manual data pulls
            </div>
          </div>

          {/* After */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground">AFTER</div>
            <div className="space-y-1.5">
              <div className="h-1 bg-foreground/60 rounded w-full" />
              <div className="h-1 bg-foreground/60 rounded w-4/5" />
              <div className="h-1 bg-foreground/60 rounded w-3/5" />
            </div>
            <div className="text-xs text-foreground pt-1">
              Self-serve answers
            </div>
          </div>

          {/* Tools used */}
          <div className="col-span-2 border-t border-border pt-2 mt-auto">
            <div className="flex flex-wrap gap-1.5">
              <div className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                Linear
              </div>
              <div className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                GitHub
              </div>
              <div className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                Slack
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Card 3: Multi-Agent Execution (Visual Bars)
function MultiAgentCard() {
  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden flex flex-col h-[400px]">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="font-mono text-xs bg-muted text-foreground px-2 py-1 rounded">
            AGENT
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Multi-Agent Execution
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Orchestrated execution across code tools
        </p>
      </div>

      {/* Content - Agent Bars */}
      <div className="flex-1 p-4 border border-border mx-4 mb-4 bg-muted/30 rounded-sm overflow-auto">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-foreground">
                Claude Code
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded" />
            <div className="h-1.5 bg-foreground/60 rounded w-full" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-foreground">GitHub</span>
            </div>
            <div className="h-1.5 bg-muted rounded" />
            <div className="h-1.5 bg-foreground/60 rounded w-3/4" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-foreground">Linear</span>
            </div>
            <div className="h-1.5 bg-muted rounded" />
            <div className="h-1.5 bg-foreground/60 rounded w-1/2" />
          </div>

          <div className="pt-2 border-t border-border">
            <div className="text-xs text-foreground">
              ✓ PR created, ticket updated
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
