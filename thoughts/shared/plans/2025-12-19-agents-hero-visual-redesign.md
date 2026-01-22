# Agents Hero Visual Redesign Implementation Plan

## Overview

Replace the static hero image on the agents page with a new minimal, static visual component (`AgentHeroVisual`) that shows a consumer-friendly agent UI composition: a chat input at the top and an agent action card with response below. The visual uses the VisualShowcase overlay pattern (blurred background image + content layer) adapted for the smaller aspect-[4/3] hero slot.

## Current State Analysis

### What exists now:
- **agents/page.tsx:107-118**: Media column with static `<Image>` using Cloudflare Images URL
- **visual-showcase.tsx**: Three-layer CSS grid overlay pattern (background → blur → content)
- **mcp-agent-visual.tsx**: Detailed developer-focused visual with code-style tool calls (too technical for hero)
- **semantic-search-visual.tsx & neural-memory-visual.tsx**: Reference patterns for minimal card-based layouts

### Key Discoveries:
- The hero media column uses `aspect-[4/3]` and `col-span-7` on lg+ (`visual-showcase.tsx:45` uses `min-h-[850px]` which is too tall for hero)
- Visual components use `bg-background`, `bg-secondary`, `rounded-md` consistently
- Lucide icons are imported directly (e.g., `Search` from "lucide-react")
- All visuals use tailwind classes with the existing design tokens

## Desired End State

A new `AgentHeroVisual` component that:
1. Fits the existing `aspect-[4/3]` media column slot (replacing the static image)
2. Shows a minimal, static composition inspired by consumer chat UIs:
   - Top: Clean chat input with sample query
   - Bottom: Agent action card showing search in progress + response bubble
3. Uses inline VisualShowcase-style overlay (adapted for smaller size)
4. Is completely static (no animations)
5. Maintains responsive behavior

### Verification:
- Visual renders correctly at all breakpoints (mobile: 100vw, desktop: ~50vw)
- Matches the existing design system (tokens, spacing, typography)
- Hero section maintains `min-h-[500px] lg:min-h-[600px]` layout

## What We're NOT Doing

- Adding animations or transitions to the visual
- Showing the Tools dropdown/menu (from reference Image 2)
- Including Lightfast-specific tool names like `lightfast_search` (keeping it consumer-friendly)
- Creating a reusable wrapper component—the overlay pattern will be inline
- Changing the VisualShowcase component used elsewhere

## Implementation Approach

Single-phase implementation: Create the component and integrate it into the agents page.

## Phase 1: Create AgentHeroVisual Component

### Overview
Create a new static visual component for the agents page hero section that shows a minimal chat + action card UI.

### Changes Required:

#### 1. Create new component file
**File**: `apps/www/src/components/landing/agent-hero-visual.tsx`

```tsx
/**
 * Agent Hero Visual Component
 *
 * A minimal, consumer-friendly visual for the agents page hero section.
 * Shows a chat input with query and an agent action card with response.
 * Self-contained with built-in VisualShowcase-style overlay.
 */

import Image from "next/image";
import { Search, ArrowRight, Sparkles } from "lucide-react";

export function AgentHeroVisual() {
  return (
    <div className="relative grid grid-cols-1 grid-rows-1 rounded-lg overflow-hidden border border-border aspect-[4/3]">
      {/* Background Image Layer */}
      <div className="relative z-[1] col-span-full row-span-full overflow-hidden">
        <Image
          className="h-full w-full select-none object-cover"
          alt="Agent visual background"
          src="https://imagedelivery.net/UEsH3Cp6PfMQ5nCsxDnDxQ/596ee9cd-4dcc-4b0d-18f7-c60f53b02400/public"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          quality={10}
          draggable={false}
        />
      </div>

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
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
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
```

#### 2. Update agents page to use new component
**File**: `apps/www/src/app/(app)/(marketing)/features/agents/page.tsx`

**Change 1**: Add import for the new component (after line 8)
```tsx
import { AgentHeroVisual } from "~/components/landing/agent-hero-visual";
```

**Change 2**: Replace the Image component in media column (lines 107-118)

Replace:
```tsx
{/* Media Column */}
<div className="col-span-12 lg:col-span-7">
  <div className="relative aspect-[4/3] rounded-lg border border-border overflow-hidden">
    <Image
      src="https://imagedelivery.net/UEsH3Cp6PfMQ5nCsxDnDxQ/3932e2f7-ef96-4b98-852c-3d281e468d00/public"
      alt="AI agents with memory layer"
      fill
      className="object-cover"
      sizes="(max-width: 1024px) 100vw, 50vw"
      priority
    />
  </div>
</div>
```

With:
```tsx
{/* Media Column */}
<div className="col-span-12 lg:col-span-7">
  <AgentHeroVisual />
</div>
```

**Change 3**: Remove unused Image import if no longer needed (line 3)

Check if `Image` is still used elsewhere in the file. If not, remove the import:
```diff
- import Image from "next/image";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @lightfast/www typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/www lint` (no new errors in modified files)
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Visual renders correctly at mobile breakpoint (full width)
- [ ] Visual renders correctly at desktop breakpoint (col-span-7)
- [ ] Frosted blur overlay effect is visible over background image
- [ ] Chat input and action card are clearly legible
- [ ] Component maintains aspect-[4/3] ratio
- [ ] No visual regressions in the rest of the agents page

---

## Testing Strategy

### Visual Testing:
- Test at 375px (mobile), 768px (tablet), 1024px (lg breakpoint), 1440px (desktop)
- Verify text remains readable at all sizes
- Confirm background blur effect works across browsers

### Manual Testing Steps:
1. Navigate to `/features/agents`
2. Verify hero section displays the new visual (not the old static image)
3. Resize browser to confirm responsive behavior
4. Check that the visual maintains aspect ratio and content stays centered
5. Scroll down to verify McpAgentVisual in VisualShowcase still works correctly

## Performance Considerations

- Background image uses `quality={10}` to minimize size (matches VisualShowcase pattern)
- Uses `priority` for LCP optimization
- No JavaScript interactivity needed (static component)

## References

- Research document: `thoughts/shared/research/2025-12-19-agents-hero-visual-redesign.md`
- VisualShowcase pattern: `apps/www/src/components/visual-showcase.tsx:25-52`
- Existing visual patterns: `apps/www/src/components/landing/semantic-search-visual.tsx`
