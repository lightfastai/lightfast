---
date: 2025-12-19T16:45:00+08:00
researcher: claude
git_commit: c05be6d8
branch: main
repository: lightfast
topic: "Agents Page Hero Visual Redesign - Minimal Agent UI Component"
tags: [research, codebase, agents-page, visual-component, hero-section]
status: complete
last_updated: 2025-12-19
last_updated_by: claude
---

# Research: Agents Page Hero Visual Redesign

**Date**: 2025-12-19T16:45:00+08:00
**Researcher**: claude
**Git Commit**: c05be6d8
**Branch**: main
**Repository**: lightfast

## Research Question

How to rework the media column in the agents page hero section with a minimal visual component inspired by 3 reference images, overlaid on a background image similar to the VisualShowcase pattern.

## Summary

The current agents page (`apps/www/src/app/(app)/(marketing)/features/agents/page.tsx`) uses a static image in the hero media column, with the detailed `McpAgentVisual` component appearing below wrapped in `VisualShowcase`. The user wants to create a new minimal component for the hero that:

1. **Fits the existing col-span-7 media column** (responsive: 100vw on mobile, 50vw on desktop, max-width 1024px)
2. **Uses the VisualShowcase overlay pattern** (blurred background image + content layer)
3. **Is simpler/more minimal than McpAgentVisual** (which shows detailed code-style tool calls)
4. **Takes inspiration from 3 reference images** showing consumer-friendly agent UI

## Reference Image Analysis

### Image 1: Chat Input
- Clean white rounded card on blurred blue gradient background
- Simple text prompt: "I'm hiring engineers for my startup. Can you help me find some candidates in NYC."
- Bottom row: `+` button, `Tools` with settings icon, microphone, send button
- **Key takeaway**: Minimal chat input UI, not code-style

### Image 2: Agent Tools Menu
- Dropdown/popover with agent capabilities
- Options: "Run deep research", "Agent mode", "Use connectors", "Create an image", "Write or code", "Search the web"
- Icons next to each option
- Cursor pointing at "Agent mode"
- **Key takeaway**: Shows available agent tools/modes in consumer UI

### Image 3: Agent Action Card
- Header: Globe icon + "Visiting LinkedIn and gathering profiles"
- Embedded preview showing LinkedIn with skeleton UI placeholders
- Floating response bubble: "I've found 7 candidates that fit your criteria. I'm adding them to your spreadsheet."
- **Key takeaway**: Agent in action with real-time feedback

## Current Implementation Details

### agents/page.tsx:74-119 - Hero Section
```tsx
{/* Hero Section — Split */}
<div className="max-w-6xl mx-auto grid grid-cols-12 gap-8 items-center px-4 min-h-[500px] lg:min-h-[600px]">
  {/* Text Column - col-span-5 */}
  <div className="col-span-12 lg:col-span-5">
    {/* Title, description, CTAs */}
  </div>

  {/* Media Column - col-span-7 */}
  <div className="col-span-12 lg:col-span-7">
    <div className="relative aspect-[4/3] rounded-lg border border-border overflow-hidden">
      <Image
        src="https://imagedelivery.net/..."
        alt="AI agents with memory layer"
        fill
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 50vw"
        priority
      />
    </div>
  </div>
</div>
```

### visual-showcase.tsx - Overlay Pattern
Three layers using CSS grid stacking:
1. **Background Image** (z-1): Full bleed image, object-cover
2. **Frosted Blur** (z-10): `backdrop-blur-md` overlay
3. **Content** (z-20): Children rendered with padding

### mcp-agent-visual.tsx - Current Detailed Visual
Shows code-style interface:
- `agent.query("Find all PRs related to authentication changes")`
- Tool calls: `lightfast_search()`, `lightfast_contents()`
- Results with arrows and PR references
- Response summary

**Why this is TOO detailed for hero**: It's developer-focused, shows implementation details. The reference images show consumer-friendly UI.

## Proposed Component Design

Based on the reference images and constraints, the new hero visual should:

### Option A: Static Chat + Action Card (Recommended)
A minimal composition showing:
1. **Top**: Clean chat input with sample query (inspired by Image 1)
2. **Bottom**: Agent action card with status (inspired by Image 3)

```
┌─────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────┐ │
│ │ "Find PRs about authentication"    [→]  │ │  ← Chat input
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 🔍 Searching memory layer...            │ │  ← Action status
│ │                                         │ │
│ │ ┌───────────────────────────────────┐   │ │
│ │ │ "Found 12 PRs. The most recent    │   │ │  ← Response bubble
│ │ │  is PR #1289 by Sarah Chen..."    │   │ │
│ │ └───────────────────────────────────┘   │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Option B: Tools Menu Focus (Alternative)
Show the Tools dropdown with Lightfast-specific options:
- Search memory
- Get contents
- Find similar
- Get answer

This aligns with the "Four routes. That's it." section below.

## Size Constraints

The media column uses:
- `col-span-12` on mobile, `col-span-7` on lg+
- `aspect-[4/3]` ratio
- `sizes="(max-width: 1024px) 100vw, 50vw"`

New component should:
- Maintain aspect-[4/3] or similar
- Use VisualShowcase-style overlay (scaled down)
- Rounded corners with border
- Responsive padding

## Code References

- `apps/www/src/app/(app)/(marketing)/features/agents/page.tsx:107-118` - Current media column
- `apps/www/src/components/visual-showcase.tsx:25-52` - Overlay pattern to replicate
- `apps/www/src/components/landing/mcp-agent-visual.tsx:14-25` - Query display pattern (adapt for simplicity)

## Implementation Notes

1. Create new component: `apps/www/src/components/landing/agent-hero-visual.tsx`
2. Use inline VisualShowcase-style overlay (no min-height 850px needed)
3. Adapt aspect ratio to 4/3 to match current image slot
4. Keep content minimal - show the value prop without implementation details
5. Use same background image from VisualShowcase or the current hero image

## Open Questions

1. Should the visual be completely static or have subtle animations?
2. Should it show Lightfast-specific tools (lightfast_search) or generic agent UI?
3. Should it include the Tools menu from Image 2, or just the chat+action pattern?
