# Pitch Deck Content Update Implementation Plan

## Overview

Update the pitch deck content to align with pre-revenue, pre-seed raise strategy ($300k on post-money SAFE for 7%). This includes adding two new slides (Unique Insight, Why Now), updating existing content to be more specific and outcome-focused, and reframing the Traction slide as Validation with qualitative signals.

## Current State Analysis

**Current Structure** (8 slides):
1. Title - "LIGHTFAST"
2. Intro - Generic company intro
3. Problem - "Context is scattered" with 4 bullet points
4. Solution - "A unified memory layer" with 4 bullet points
5. Traction - Placeholder metrics (500+ waitlist, 3 partners, etc.)
6. Team - Generic founder descriptions
7. Ask - "$1.5M SEED" (incorrect amount)
8. Vision - "Every team deserves a perfect memory."

**Issues Identified:**
- Ask shows $1.5M seed instead of $300K pre-seed
- Traction has placeholder metrics that don't exist
- Missing "Unique Insight" slide (most important for pre-revenue per VC guidance)
- Missing "Why Now" slide (critical per Sequoia)
- Content is generic, needs to be more specific and outcome-focused

### Key Discoveries:
- Slide data defined in `apps/www/src/config/pitch-deck-data.ts:1-98`
- Two slide types: "title" (id, type, title, subtitle, bgColor) and "content" (id, type, title, leftText, rightText[], bgColor, textColor)
- Scroll container height calculated as `(PITCH_SLIDES.length + 1) * 100vh` - adding slides will automatically adjust
- Grid threshold at 0.92 scroll progress works regardless of slide count

## Desired End State

**New Structure** (10 slides):
1. Title - "LIGHTFAST" (unchanged)
2. Intro - Updated messaging focused on outcomes
3. Problem - More specific with $ impact
4. Solution - Concrete features with specifics
5. **Unique Insight (NEW)** - Two-key retrieval technical differentiation
6. **Why Now (NEW)** - Market timing signals
7. Team - Placeholder for specific accomplishments
8. **Validation (renamed)** - Qualitative signals, honest about stage
9. Ask - "$300K PRE-SEED" with realistic milestones
10. Vision - (unchanged)

**Verification:**
- All 10 slides render correctly in scroll view
- Grid view displays all 10 slides
- PDF export captures all 10 slides
- Content aligns with research recommendations

## What We're NOT Doing

- Changing visual design/styling
- Modifying animation behavior
- Updating slide component code
- Changing PDF export logic
- Adding new slide types (using existing "content" type for new slides)

## Implementation Approach

Single-phase update to the `pitch-deck-data.ts` configuration file. No component changes needed since the data structure supports variable slide counts and the existing "content" type works for the new slides.

## Phase 1: Update Pitch Deck Content

### Overview
Update the PITCH_SLIDES array in the configuration file with revised content and two new slides.

### Changes Required:

#### 1. Update Configuration File
**File**: `apps/www/src/config/pitch-deck-data.ts`
**Changes**: Replace entire PITCH_SLIDES array with updated content

```typescript
export const PITCH_SLIDES = [
  // Slide 1: Title (unchanged)
  {
    id: "title",
    type: "title" as const,
    title: "LIGHTFAST",
    subtitle: "Pitch deck 2026 —",
    bgColor: "bg-[#8B3A3A]",
  },
  // Slide 2: Intro (updated content)
  {
    id: "intro",
    type: "content" as const,
    title: "Hi, we are Lightfast.",
    leftText: "THE MEMORY LAYER FOR ENGINEERING TEAMS",
    rightText: [
      "Any engineer or AI agent can ask 'what broke?', 'who owns this?', or 'why was this decision made?'—and get accurate answers with sources.",
      "We connect GitHub, Vercel, and your engineering tools to create searchable memory across your entire org.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 3: Problem (more specific with $ impact)
  {
    id: "problem",
    type: "content" as const,
    title: "The Problem.",
    leftText: "CONTEXT IS SCATTERED",
    rightText: [
      "Engineers spend 30% of their time searching for context—costing companies $40K+/engineer/year",
      "Knowledge lives across 8+ tools—each with its own search that doesn't understand meaning",
      "When engineers leave, their understanding of 'why' walks out with them",
      "AI coding assistants hallucinate because they can't access your team's history",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 4: Solution (concrete and outcome-focused)
  {
    id: "solution",
    type: "content" as const,
    title: "Our Solution.",
    leftText: "A UNIFIED MEMORY LAYER",
    rightText: [
      "Connect GitHub, Vercel, and docs in 5 minutes with OAuth—no configuration files",
      "Semantic search understands 'authentication flow changes' not just 'auth'",
      "Every answer cites its source—PR, commit, discussion, or document",
      "MCP tools let AI agents access your team's memory natively",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 5: Unique Insight (NEW - most important for pre-revenue)
  {
    id: "insight",
    type: "content" as const,
    title: "Our Insight.",
    leftText: "THE NON-OBVIOUS TRUTH",
    rightText: [
      "Vector search alone gives 60-70% precision—too noisy for engineers to trust",
      "We add a second 'key': LLM validation of relevance after vector retrieval",
      "Two-key retrieval achieves 90%+ precision—answers worth trusting",
      "Plus: multi-view embeddings, entity extraction, and contributor context",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 6: Why Now (NEW - market timing)
  {
    id: "why-now",
    type: "content" as const,
    title: "Why Now.",
    leftText: "THE MARKET IS READY",
    rightText: [
      "Foundation models crossed the capability threshold in 2025 (80%+ SWE-bench)",
      "Vector databases became production-ready (Pinecone, Weaviate at scale)",
      "MCP protocol creating standard for AI agent context access",
      "Enterprise AI assistant adoption jumping from 14% to 90% by 2028",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 7: Team (placeholder for specific accomplishments)
  {
    id: "team",
    type: "content" as const,
    title: "The Team.",
    leftText: "WHY US FOR THIS",
    rightText: [
      "[Name]: Built search at [Company], served X queries/day",
      "[Name]: Led ML infra at [Company], scaled to Y scale",
      "Together: [Specific relevant accomplishment showing founder-market fit]",
      "Advisors: [Notable names if any]",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 8: Validation (renamed from Traction - qualitative signals)
  {
    id: "validation",
    type: "content" as const,
    title: "Validation.",
    leftText: "WHY WE'RE BUILDING THIS",
    rightText: [
      "We lived this problem—spent years watching context evaporate across teams",
      "Interviewed 15+ engineering leads—100% said context loss is top-3 pain",
      "Existing solutions (Sourcegraph, Confluence) rated 'inadequate' by 80%",
      "AI agent builders specifically asking for memory layer access",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 9: Ask (updated to $300K pre-seed)
  {
    id: "ask",
    type: "content" as const,
    title: "The Ask.",
    leftText: "RAISING $300K PRE-SEED",
    rightText: [
      "12 months runway at current burn",
      "Ship public beta in Q2 2026",
      "Onboard 10 design partners with feedback loops",
      "Hit first $5K MRR by month 9",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 10: Vision (unchanged)
  {
    id: "vision",
    type: "title" as const,
    title: "Every team deserves a perfect memory.",
    subtitle: "jp@jeevanpillay.com",
    bgColor: "bg-[#8B3A3A]",
  },
] as const;
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @lightfast/www typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/www lint` (no errors in pitch-deck-data.ts; pre-existing errors in other files)
- [x] Build succeeds: `pnpm --filter @lightfast/www build`

#### Manual Verification:
- [x] All 10 slides render in scroll view at `/pitch-deck`
- [x] Scroll animations work smoothly through all slides
- [x] Grid view (scroll to end) shows all 10 slide thumbnails
- [x] PDF export downloads with all 10 slides
- [x] Content is readable and properly formatted on each slide
- [x] No visual regressions in styling

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Automated Tests:
- TypeScript compilation (type safety of slide data)
- Lint checks (code quality)
- Build verification (no runtime errors)

### Manual Testing Steps:
1. Navigate to `/pitch-deck` in development
2. Scroll through all 10 slides, verify stacking animation
3. Check each slide's content matches the plan
4. Scroll past the last slide to trigger grid view
5. Verify all 10 thumbnails appear in grid
6. Click the download button
7. Open the PDF and verify all 10 slides exported correctly
8. Check mobile view (preface should auto-collapse, slides responsive)

## Performance Considerations

- Adding 2 slides increases scroll container from 900vh to 1100vh
- Grid view renders 10 thumbnails instead of 8 (minimal impact)
- PDF export processes 10 slides instead of 8 (slight increase in export time)
- No performance concerns expected

## References

- Content strategy research: `thoughts/shared/research/2026-01-28-pitch-deck-content-strategy.md`
- VC guidance research: `thoughts/shared/research/2026-01-22-web-analysis-seed-pitch-deck-vc-guidance.md`
- Original implementation plan: `thoughts/shared/plans/2026-01-22-pitch-deck-page.md`

## Notes

- Team slide uses placeholder brackets `[Name]`, `[Company]`, etc. that need to be filled in with actual founder information
- Validation slide bullet points should be updated with real interview counts/data when available
- The $300K at 7% post-money implies ~$4.3M valuation cap
