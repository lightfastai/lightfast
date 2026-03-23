# Landing Hero — Stream Events Stagger & Smart Packing

## Overview

Rework the `StreamEvents` component (`packages/app-remotion/src/compositions/landing-hero/sections/stream-events.tsx`) to:
1. **Stagger** the scroll animation so each row moves with a per-row wave delay (top-to-bottom cascade) instead of all rows moving in lockstep.
2. **Smart-pack** items into the fixed 512px container so every visible item is always 100% within bounds — no clipping, no fade, no partial items.

## Current State Analysis

**File**: `packages/app-remotion/src/compositions/landing-hero/sections/stream-events.tsx`

### Current scroll model
- 10 events in a circular list (`FEED_EVENTS`), 2 with `extra` lines (Sentry items).
- Single `scrollOffset` applied identically to all rows (line 156-158).
- Every 30 frames (`FRAMES_PER_EVENT`), the list shifts by one `eventPitch` over 10 frames (`STEP_MOVE_FRAMES`).
- Items are positioned with `rowTop = PADDING + baseCumPosition + scrollOffset`.
- Container is 512px with `overflow-hidden` — items at edges get hard-clipped.

### Item heights
- **Compact** (8 of 10): ~74px (py-3 + source-line + gap + label-line + border)
- **With extras** (2 of 10 — Sentry items at indices 2 and 6): ~115px (compact + overhead + extra lines)
- **Pitch** = height + 8px gap: compact ~82px, Sentry ~123px

### Key discoveries
- `timing.ts:44-47` defines `ROW_STAGGER.STREAM_EVENTS = 6` but it's **unused** — the stagger was planned but never implemented.
- The scroll loops every 300 frames (`LOOP_FRAMES = 10 * 30`), which divides evenly for seamless GIF restart.
- `ROWS_TO_RENDER` over-allocates (~30 rows) because of the overflow-hidden approach. Smart packing will render only ~6-7 at a time.

## Desired End State

1. When the scroll triggers, each visible row begins its movement with a **wave delay** — the topmost row moves first, each subsequent row follows N frames later. Creates a cascading domino effect.
2. At every **resting frame** (between scroll steps), the container shows only items that **fully fit** within 512px. No partial items visible. No overflow-hidden clipping.
3. When a **tall item (Sentry, ~115px) exits** the bottom, the freed space admits **multiple compact items (~74px)**. They enter together as a batch.
4. New events **enter from the top**, pushing existing items downward.
5. The animation **loops seamlessly** every 300 frames for GIF/WebM output.

### Verification
- Scrub through every frame in the Remotion preview — no item should ever be partially visible at the container top or bottom.
- The wave delay should be visually distinct: pausing on a mid-transition frame should show rows at different positions in their travel.
- After 300 frames, the state matches frame 0 exactly.

## What We're NOT Doing

- Not changing item content, styles, or the visual design of event cards.
- Not changing the container width, position, or the isometric grid layout.
- Not adding fade/opacity effects at container edges.
- Not modifying other sections (IngestedData, LogoAnimation, GridLines).
- Not changing the timing/render profile constants in `index.tsx`.

## Implementation Approach

Replace the current "single scrollOffset + overflow-hidden" model with a **window-based** model:
- Precompute which items are visible at each rest state (a "window").
- During transitions, animate per-row with wave-staggered progress.
- Render only items in the current/next window union.

---

## Phase 1: Smart Window Precomputation

### Overview
Add logic to compute the "visible window" for each step — which items fit in 512px when that step is the resting state.

### Changes Required

#### 1. Visible window calculator
**File**: `packages/app-remotion/src/compositions/landing-hero/sections/stream-events.tsx`

Add after the existing `eventPitches` / `cumPitch` block (~line 114):

```typescript
/**
 * For each step s, compute which event indices are visible when the
 * container is at rest (new item fully entered, no transition in progress).
 *
 * At step s, the top item is event index (s % N). Items fill downward
 * until the next would overflow the container.
 */
const MAX_CONTENT_HEIGHT = FEED_HEIGHT - FEED_PADDING_Y * 2; // 512 - 16 = 496

interface VisibleWindow {
  /** Event indices visible in this window, ordered top-to-bottom */
  indices: number[];
  /** Cumulative Y offset of each item within the container (top of item relative to container content area) */
  offsets: number[];
  /** Total content height (sum of heights + gaps between items) */
  totalHeight: number;
}

function computeVisibleWindow(topEventIndex: number): VisibleWindow {
  const indices: number[] = [];
  const offsets: number[] = [];
  let used = 0;

  for (let offset = 0; offset < N; offset++) {
    const idx = (topEventIndex + offset) % N;
    const h = eventHeights[idx] ?? 0;

    // Check if this item fits (account for gap if not the first)
    const gapNeeded = indices.length > 0 ? ROW_GAP : 0;
    if (used + gapNeeded + h > MAX_CONTENT_HEIGHT) break;

    offsets.push(used + gapNeeded);
    used += gapNeeded + h;
    indices.push(idx);
  }

  return { indices, offsets, totalHeight: used };
}

/** Precomputed visible windows for every step in the cycle */
const WINDOWS: VisibleWindow[] = Array.from({ length: N }, (_, s) =>
  computeVisibleWindow(s)
);
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] Add a `console.log(WINDOWS)` temporarily and verify each window's items fit within 496px.
- [ ] Verify windows with Sentry items (indices 2, 6) contain fewer total items due to their larger height.

**Implementation Note**: This phase is additive — existing scroll logic still runs. Phase 2 replaces it.

---

## Phase 2: Wave-Staggered Scroll Engine

### Overview
Replace the single `scrollOffset` model with per-row animated positions using wave delay. Each visible row transitions independently from its old position to its new position.

### Changes Required

#### 1. Wave delay constants
**File**: `packages/app-remotion/src/compositions/landing-hero/shared/timing.ts`

Update `ROW_STAGGER.STREAM_EVENTS` (already exists but unused):

```typescript
export const ROW_STAGGER = {
  STREAM_EVENTS: 3, // frames of delay between each row's wave start (was 6)
  INGESTED_DATA: 24,
} as const;
```

3 frames per row × ~6 visible rows = 18 frame spread + 10 frame animation = 28 total. Fits comfortably in the 30-frame step budget.

#### 2. Rewrite scroll logic in StreamEvents
**File**: `packages/app-remotion/src/compositions/landing-hero/sections/stream-events.tsx`

Replace the current component body (lines 146-224) with the window-based approach:

```typescript
export const StreamEvents: React.FC = () => {
  const frame = useCurrentFrame();

  // ── Step timing (unchanged) ──
  const streamFrame = frame % LOOP_FRAMES;
  const stepIndex = Math.floor(streamFrame / FRAMES_PER_EVENT);
  const stepFrame = streamFrame % FRAMES_PER_EVENT;

  // ── Windows: current resting state and the next one ──
  const currWindow = WINDOWS[stepIndex % N]!;
  const nextWindow = WINDOWS[(stepIndex + 1) % N]!;

  // ── Build render list: union of items visible in current and/or next window ──
  // Each item needs: its Y position in currWindow, its Y position in nextWindow,
  // and its per-row wave progress.
  const renderItems: Array<{
    eventIndex: number;
    event: FeedEvent;
    fromY: number | null;   // null = entering (not in current window)
    toY: number | null;     // null = exiting (not in next window)
    waveIndex: number;      // position in wave ordering (0 = first to move)
  }> = [];

  // Items in the NEXT window get wave indices 0..N (they define the target state)
  const nextIndexSet = new Set(nextWindow.indices);
  const currIndexSet = new Set(currWindow.indices);

  // First: items in nextWindow (these are the target state, drive the wave order)
  for (let wi = 0; wi < nextWindow.indices.length; wi++) {
    const idx = nextWindow.indices[wi]!;
    const toY = FEED_PADDING_Y + (nextWindow.offsets[wi] ?? 0);

    // Find this item's position in currWindow (if it exists)
    const currPos = currWindow.indices.indexOf(idx);
    const fromY = currPos >= 0
      ? FEED_PADDING_Y + (currWindow.offsets[currPos] ?? 0)
      : null; // entering — wasn't in current window

    renderItems.push({
      eventIndex: idx,
      event: FEED_EVENTS[idx]!,
      fromY,
      toY,
      waveIndex: wi,
    });
  }

  // Second: items in currWindow but NOT in nextWindow (exiting at the bottom)
  for (let ci = 0; ci < currWindow.indices.length; ci++) {
    const idx = currWindow.indices[ci]!;
    if (nextIndexSet.has(idx)) continue; // already added above

    const fromY = FEED_PADDING_Y + (currWindow.offsets[ci] ?? 0);

    renderItems.push({
      eventIndex: idx,
      event: FEED_EVENTS[idx]!,
      fromY,
      toY: null, // exiting
      waveIndex: currWindow.indices.length + ci, // wave after all next-window items
    });
  }

  return (
    <div
      className="absolute"
      style={{
        left: FEED_X,
        top: FEED_Y,
        width: FEED_WIDTH,
        height: FEED_HEIGHT,
      }}
    >
      {renderItems.map(({ eventIndex, event, fromY, toY, waveIndex }) => {
        // ── Per-row wave progress ──
        const waveDelay = waveIndex * ROW_STAGGER.STREAM_EVENTS;
        const rowProgress = interpolate(
          stepFrame - waveDelay,
          [0, STEP_MOVE_FRAMES],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: STEP_EASING,
          }
        );

        // ── Compute Y position ──
        let y: number;
        let opacity = 1;

        if (fromY !== null && toY !== null) {
          // Existing item: interpolate between old and new position
          y = interpolate(rowProgress, [0, 1], [fromY, toY]);
        } else if (fromY === null && toY !== null) {
          // Entering from top: start above container, land at toY
          const entryStartY = -(eventHeights[eventIndex] ?? COMPACT_ROW_HEIGHT);
          y = interpolate(rowProgress, [0, 1], [entryStartY, toY]);
        } else if (fromY !== null && toY === null) {
          // Exiting at bottom: slide from fromY to below container
          const exitEndY = FEED_HEIGHT;
          y = interpolate(rowProgress, [0, 1], [fromY, exitEndY]);
          // Don't render if fully below container
          if (y >= FEED_HEIGHT) return null;
        } else {
          return null; // shouldn't happen
        }

        // Don't render if fully above container
        if (y + (eventHeights[eventIndex] ?? 0) < 0) return null;

        return (
          <div
            className="absolute flex flex-col gap-2 rounded-md border border-border px-3 py-3 font-sans"
            key={`${eventIndex}-${stepIndex}`}
            style={{
              left: FEED_PADDING_X,
              top: y,
              width: FEED_WIDTH - FEED_PADDING_X * 2,
              opacity,
            }}
          >
            {/* ... existing event card JSX (unchanged from current lines 186-219) ... */}
          </div>
        );
      })}
    </div>
  );
};
```

Key changes from current implementation:
- **No `overflow-hidden`** on the container — items are positioned to always be in-bounds at rest.
- **No `scrollOffset`** — each row has independent `rowProgress` with wave delay.
- **Render list** is the union of current/next window items, not a fixed over-allocated array.
- **Entering items** start at `y = -itemHeight` (above container) and wave in.
- **Exiting items** slide to `y = FEED_HEIGHT` (below container) and stop rendering.

#### 3. Remove dead code
Delete the following constants/arrays that are no longer needed:
- `ROWS_TO_RENDER` (line 123-128)
- `START_INDEX` (line 129)
- `ROW_DATA` (lines 133-141)
- `scrollOffset` computation (lines 156-158)
- The `cumPitch` array and `getCumPosition` function (lines 110-121) — windows replace cumulative scrolling
- `CYCLE_PITCH` (line 114)

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [ ] Build succeeds: `pnpm --filter app-remotion build` (or however Remotion builds)

#### Manual Verification:
- [ ] Scrub through Remotion preview frame-by-frame: at every resting frame (multiples of 30), all visible items are fully within 512px bounds.
- [ ] Wave delay is visible: pausing on a mid-transition frame shows rows at different vertical positions (top row further along than bottom rows).
- [ ] New items enter from above the container, not from inside it.
- [ ] Items exiting the bottom slide out cleanly — they're never partially visible at the container edge during rest.
- [ ] Sentry items (tall) behave correctly: when one exits, the freed space fills with compact items.
- [ ] Animation loops seamlessly after 300 frames.

**Implementation Note**: After completing this phase, pause for manual verification before Phase 3.

---

## Phase 3: Polish & Edge Cases

### Overview
Handle edge cases and refine timing for seamless looping and visual quality.

### Changes Required

#### 1. Seamless GIF loop verification
The window sequence must cycle perfectly: `WINDOWS[0]` must equal `WINDOWS[N]` (by modular arithmetic, it does since `computeVisibleWindow(N % N) = computeVisibleWindow(0)`). Verify that the visual state at frame 299 transitions smoothly to frame 0.

#### 2. Bottom gap handling
At rest, items may not perfectly fill 512px (there'll be unused space at the bottom). Options:
- **Vertically center** the content block within the 512px container (add `(FEED_HEIGHT - totalHeight) / 2` to all Y offsets).
- **Top-align** (current approach) and accept the bottom gap.
- **Pad gap to match**: choose which option looks better in the isometric context.

#### 3. Entry animation refinement
The entering item's start position (`y = -itemHeight`) may need tuning. If the item appears to "pop" too abruptly:
- Start further above: `y = -itemHeight - 20`
- Or use a spring instead of linear interpolation for the entering item only.

#### 4. Wave timing tuning
The `ROW_STAGGER.STREAM_EVENTS = 3` value may need adjustment after seeing it in motion:
- Too subtle (feels simultaneous): increase to 4-5
- Too slow (last row finishes after FRAMES_PER_EVENT): decrease to 2

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] GIF loop test: render a GIF and verify the loop point is seamless.
- [ ] The bottom gap (if any) looks acceptable in the isometric view.
- [ ] Wave timing feels natural — not too fast (simultaneous) or too slow (sluggish).
- [ ] The overall composition still looks cohesive with IngestedData and LogoAnimation.

---

## Testing Strategy

### Manual Testing Steps
1. Run `pnpm dev` in the Remotion workspace and open the landing-hero composition.
2. Scrub frame-by-frame through a complete 300-frame cycle.
3. At each resting frame (0, 30, 60, ..., 270): verify no items are clipped.
4. At mid-transition frames (15, 45, 75, ...): verify wave stagger is visible.
5. Find frames where Sentry items enter/exit: verify size-aware packing works.
6. Let it play at speed: verify smooth motion and seamless loop.
7. Render a GIF with existing profile and verify output quality.

## Performance Considerations

- Current `ROW_DATA` precomputes ~30 rows per frame. New approach renders only ~6-7 items per frame — should be faster.
- `WINDOWS` is precomputed at module load (10 windows) — zero per-frame cost.
- Per-frame: one `interpolate` call per visible item (~6-7) instead of positioning ~30 items. Net improvement.
- The `renderItems` array is rebuilt each frame (~12-14 items in the union). Consider memoizing if needed, but at 6-7 items this is negligible.

## References

- Current implementation: `packages/app-remotion/src/compositions/landing-hero/sections/stream-events.tsx`
- Timing constants: `packages/app-remotion/src/compositions/landing-hero/shared/timing.ts`
- Isometric layout: `packages/app-remotion/src/compositions/landing-hero/landing-hero.tsx`
- Unused stagger constant: `timing.ts:44-47` (`ROW_STAGGER.STREAM_EVENTS = 6`)
