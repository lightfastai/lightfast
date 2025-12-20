/**
 * Agent Hero Visual Component
 *
 * A minimal, consumer-friendly visual for the agents page hero section.
 * Shows a chat input with query and an agent action card with response.
 * Self-contained with built-in VisualShowcase-style overlay.
 */

import { Search, ArrowRight } from "lucide-react";

export function AgentHeroVisual() {
  return (
    <div className="relative grid grid-cols-1 grid-rows-1 rounded-sm overflow-hidden aspect-[4/3]">
      {/* Background Image Layer */}
      <div className="relative z-[1] bg-card border border-border col-span-full row-span-full overflow-hidden"></div>

      {/* Frosted Glass Blur Overlay */}
      <div className="absolute inset-0 z-10 col-span-full row-span-full backdrop-blur-md" />

      {/* Content Layer */}
      <div className="z-20 col-span-full row-span-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md flex flex-col gap-4">
          {/* Chat Input Card */}
          <div className="bg-background rounded-lg p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">
                Find all PRs related to authentication
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
            </div>
          </div>

          {/* Agent Action Card */}
          <div className="bg-background rounded-lg p-3 sm:p-4 shadow-sm">
            {/* Status Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Searching memory layer...
              </span>
            </div>

            {/* Response Bubble */}
            <div className="bg-secondary rounded-md p-3">
              <p className="text-sm text-foreground">
                Found 12 PRs. The most recent is PR #1289 by Sarah Chen, which
                adds Clerk integration for authentication.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
