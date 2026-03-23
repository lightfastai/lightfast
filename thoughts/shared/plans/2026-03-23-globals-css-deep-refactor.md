# globals.css Deep Code Smell Refactor

## Overview

Remove unused CSS variables, utility classes, and keyframes from `packages/ui/src/globals.css`, and fix code smells (mixed color formats, missing definitions, dead comments). This is a pure cleanup — no behavior changes.

## Current State Analysis

`globals.css` (382 lines) defines design tokens, theme variables, and utility classes for the entire monorepo. Over time, unused tokens and inconsistencies have accumulated.

### Key Discoveries:
- 5 chart color variables + 10 theme mappings defined but never used anywhere (`globals.css:37-41, 124-128, 190-194`)
- 2 sidebar-primary variables defined but no Tailwind class ever references them (`globals.css:44-45, 131-132, 197-198`)
- 5 scroll-anchor spacing variables defined, consumed only within globals.css itself, never externally (`globals.css:155-164`)
- 11 utility classes defined but never used in any component (`globals.css:265-380`)
- 2 keyframe animations defined but never applied (`globals.css:351-380`)
- Hex and rgba() values mixed with otherwise-consistent oklch system (`globals.css:144-145, 151-152, 203-204`)
- `--destructive-foreground` defined only in `.dark`, missing from `:root` (`globals.css:183`)
- Dead commented-out code and misleading comment (`globals.css:252-253`)

## Desired End State

A leaner `globals.css` (~285 lines, ~25% reduction) with:
- Only variables/utilities that are actually consumed
- Consistent oklch color format throughout
- No dead comments or misleading annotations
- Complete token definitions (both :root and .dark where needed)

### Verification:
- `pnpm check && pnpm typecheck` passes
- `pnpm build:app` and `pnpm build:www` succeed (CSS consumed by both apps)
- Visual spot-check of dark mode — destructive toasts, scrollbars, pitch deck pages

## What We're NOT Doing

- Changing any color values (only converting format, not the rendered color)
- Restructuring the file layout or merging with app-level CSS
- Removing the `@utility prose` block (used by fumadocs)
- Removing text-size overrides (all used, including text-md)
- Touching `packages/app-remotion/src/styles.css` (separate scope)
- Removing `--tw-prose-invert-*` variants (standard @tailwindcss/typography pattern)

## Phase 1: Remove Unused Variables

### Overview
Remove CSS custom properties that have zero references outside globals.css.

### Changes Required:

#### 1. Remove chart color tokens from `@theme inline`
**File**: `packages/ui/src/globals.css`
**Lines**: 37-41
**Remove**:
```css
--color-chart-1: var(--chart-1);
--color-chart-2: var(--chart-2);
--color-chart-3: var(--chart-3);
--color-chart-4: var(--chart-4);
--color-chart-5: var(--chart-5);
```

#### 2. Remove sidebar-primary tokens from `@theme inline`
**File**: `packages/ui/src/globals.css`
**Lines**: 44-45
**Remove**:
```css
--color-sidebar-primary: var(--sidebar-primary);
--color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
```

#### 3. Remove `--color-brand-blue` from `@theme inline`
**File**: `packages/ui/src/globals.css`
**Line**: 50
**Remove**:
```css
--color-brand-blue: var(--brand-blue);
```

#### 4. Remove chart variables from `:root`
**File**: `packages/ui/src/globals.css`
**Lines**: 124-128
**Remove**:
```css
--chart-1: oklch(0.646 0.222 41.116);
--chart-2: oklch(0.6 0.118 184.704);
--chart-3: oklch(0.398 0.07 227.392);
--chart-4: oklch(0.828 0.189 84.429);
--chart-5: oklch(0.769 0.188 70.08);
```

#### 5. Remove sidebar-primary variables from `:root`
**File**: `packages/ui/src/globals.css`
**Lines**: 131-132
**Remove**:
```css
--sidebar-primary: oklch(0.205 0 0);
--sidebar-primary-foreground: oklch(0.985 0 0);
```

#### 6. Remove unused brand variables from `:root`
**File**: `packages/ui/src/globals.css`
**Lines**: 139, 141-142
**Remove**:
```css
--brand-blue: oklch(0.4868 0.2565 266.23);
--brand-orange-overlay: oklch(0.6496 0.2375 31.9);
--brand-gray: oklch(0.1957 0 0);
```
**Keep**: `--brand-orange` (used in alpha-banner.tsx via `bg-[var(--brand-orange)]`)

#### 7. Remove scroll anchor variables from `:root`
**File**: `packages/ui/src/globals.css`
**Lines**: 155-164
**Remove**:
```css
/* Scroll anchor variables for chat */
--spacing-input-area: 4rem;
--spacing-app-header: 3.5rem;
--spacing-scroll-area: calc(
  -1 * (var(--spacing-input-area) + var(--spacing-app-header))
);
--spacing-scroll-anchor-offset: 140px;
--spacing-scroll-anchor: calc(
  var(--spacing-scroll-area) - var(--spacing-scroll-anchor-offset) + 100dvh
);
```

#### 8. Remove chart variables from `.dark`
**File**: `packages/ui/src/globals.css`
**Lines**: 190-194
**Remove**:
```css
--chart-1: oklch(0.7058 0 0);
--chart-2: oklch(0.6714 0.0339 206.3482);
--chart-3: oklch(0.5452 0 0);
--chart-4: oklch(0.4604 0 0);
--chart-5: oklch(0.3715 0 0);
```

#### 9. Remove sidebar-primary variables from `.dark`
**File**: `packages/ui/src/globals.css`
**Lines**: 197-198
**Remove**:
```css
--sidebar-primary: oklch(0.7058 0 0);
--sidebar-primary-foreground: oklch(0.2178 0 0);
```

#### 10. Remove `--text-9xl` from `@theme inline`
**File**: `packages/ui/src/globals.css`
**Lines**: 81-82
**Remove**:
```css
--text-9xl: 6rem; /* was 8rem, now 8xl */
--text-9xl--line-height: 1;
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm check` passes (pre-existing stream-events.tsx formatting unrelated to CSS)
- [x] `pnpm typecheck` passes (pre-existing mcp#typecheck failure unrelated to CSS)
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:www` succeeds

#### Manual Verification:
- [ ] Sidebar renders correctly in app (bg-sidebar-accent still works)
- [ ] Pitch deck pages render correctly (--pitch-deck-red still works)
- [ ] Alpha banner still shows brand-orange color

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Remove Unused Utility Classes and Keyframes

### Overview
Remove 11 unused utility classes and 2 unused keyframe animations + their animation utility classes.

### Changes Required:

#### 1. Remove `app-container` utilities
**File**: `packages/ui/src/globals.css`
**Remove**:
```css
.app-container {
  @apply p-4;
}

.app-container-sm {
  @apply p-2;
}

.app-container-lg {
  @apply p-6;
}
```

#### 2. Remove unused `page-gutter` variants
**File**: `packages/ui/src/globals.css`
**Remove** (keep `page-gutter` — 11 usages):
```css
/* Smaller, app-like gutter used across console/docs */
.page-gutter-sm {
  @apply px-4 sm:px-6 lg:px-8; /* 1rem → 2rem */
}

/* Wider gutter for marketing sheets/navbars */
.page-gutter-wide {
  @apply px-8 sm:px-16; /* 2rem → 4rem at sm+ */
}

/* Mid gutter: 2rem base → 3rem at sm */
.page-gutter-md {
  @apply px-8 sm:px-12;
}
```

#### 3. Remove section-gap utilities
**File**: `packages/ui/src/globals.css`
**Remove**:
```css
/* Section spacing helpers */
.section-gap-b {
  @apply pb-32;
}

.section-gap-y {
  @apply py-32;
}
```

#### 4. Remove `scrollbar-hide` utility
**File**: `packages/ui/src/globals.css`
**Remove**:
```css
.scrollbar-hide {
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

#### 5. Remove unused keyframes and animation utilities
**File**: `packages/ui/src/globals.css`
**Remove**:
```css
/* Thinking animation keyframes */
@keyframes gradient-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes pulse-soft {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.7;
  }
}

/* Animation utility classes */
.animate-gradient-shift {
  animation: gradient-shift 3s ease infinite;
}

.animate-pulse-soft {
  animation: pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm check` passes (pre-existing failure unrelated)
- [x] `pnpm typecheck` passes (pre-existing failure unrelated)
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:www` succeeds

#### Manual Verification:
- [ ] Scrollbar styling still works in scroll areas and code blocks
- [ ] Page gutters render correctly on marketing pages

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 3: Fix Code Smells

### Overview
Fix inconsistent color formats, add missing token definitions, and clean up dead comments.

### Changes Required:

#### 1. Convert hex pitch-deck colors to oklch
**File**: `packages/ui/src/globals.css`
**Lines**: 144-145
**Change**:
```css
/* Before */
--pitch-deck-red: #e62200;
--pitch-deck-red-overlay: #ff3714;

/* After */
--pitch-deck-red: oklch(0.5023 0.2159 28.72);
--pitch-deck-red-overlay: oklch(0.5738 0.2382 30.35);
```

#### 2. Convert rgba() scrollbar colors to oklch
**File**: `packages/ui/src/globals.css`
**Lines**: 151-152 (`:root`) and 203-204 (`.dark`)
**Change**:
```css
/* :root — Before */
--scrollbar-thumb-bg: rgba(0, 0, 0, 0.2);
--scrollbar-thumb-bg-hover: rgba(0, 0, 0, 0.3);

/* :root — After */
--scrollbar-thumb-bg: oklch(0 0 0 / 0.2);
--scrollbar-thumb-bg-hover: oklch(0 0 0 / 0.3);

/* .dark — Before */
--scrollbar-thumb-bg: rgba(255, 255, 255, 0.2);
--scrollbar-thumb-bg-hover: rgba(255, 255, 255, 0.3);

/* .dark — After */
--scrollbar-thumb-bg: oklch(1 0 0 / 0.2);
--scrollbar-thumb-bg-hover: oklch(1 0 0 / 0.3);
```

#### 3. Add missing `--destructive-foreground` to `:root`
**File**: `packages/ui/src/globals.css`
**After line 119** (after `--destructive`):
```css
--destructive-foreground: oklch(1 0 0);
```
This matches the dark mode value and is consumed by `packages/ui/src/components/ui/toast.tsx`.

#### 4. Clean up dead comment and misleading annotation
**File**: `packages/ui/src/globals.css`
**Lines**: 252-253
**Change**:
```css
/* Before */
/* letter-spacing: -0.03em; /* Geist-specific letter spacing */
@apply bg-background text-foreground; /* Geist-specific letter spacing */

/* After */
@apply bg-background text-foreground;
```

#### 5. Fix `.font-sans` selector side effect
**File**: `packages/ui/src/globals.css`
**Lines**: 247-254
**Change**:
```css
/* Before */
body,
.font-sans {
  font-family:
    var(--font-geist-sans), var(--font-sans), ui-sans-serif, system-ui,
    sans-serif;
  @apply bg-background text-foreground;
}

/* After */
body {
  font-family:
    var(--font-geist-sans), var(--font-sans), ui-sans-serif, system-ui,
    sans-serif;
  @apply bg-background text-foreground;
}
.font-sans {
  font-family:
    var(--font-geist-sans), var(--font-sans), ui-sans-serif, system-ui,
    sans-serif;
}
```
This prevents `.font-sans` from inadvertently applying background/foreground colors when used on non-body elements.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm check` passes (pre-existing failure unrelated)
- [x] `pnpm typecheck` passes (pre-existing failure unrelated)
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:www` succeeds

#### Manual Verification:
- [ ] Pitch deck slides render red colors correctly (oklch conversion is color-accurate)
- [ ] Scrollbar thumb visible in both light and dark mode
- [ ] Destructive toasts render correctly in light mode (new `:root` definition)
- [ ] No background color bleeds on elements using `font-sans` class

**Implementation Note**: After completing this phase, pause for final manual verification.

---

## Testing Strategy

### Unit Tests:
- No unit tests needed — pure CSS changes

### Integration Tests:
- Build verification via `pnpm build:app` and `pnpm build:www`
- Typecheck via `pnpm typecheck`
- Lint via `pnpm check`

### Manual Testing Steps:
1. Open app in dark mode — verify sidebar, destructive toasts, scrollbars
2. Open www marketing pages — verify page gutters, pitch deck
3. Open docs pages — verify prose styling
4. Check alpha-banner — verify brand-orange color
5. Resize browser — verify no layout regressions from gutter removal

## Performance Considerations

Removing ~100 lines of unused CSS reduces the parsed stylesheet size. No runtime impact since these tokens were never consumed.

## Estimated Reduction

| Section | Lines Removed |
|---------|---------------|
| @theme inline (chart, sidebar-primary, brand-blue, text-9xl) | ~14 |
| :root (chart, sidebar-primary, brand vars, scroll anchor) | ~22 |
| .dark (chart, sidebar-primary) | ~9 |
| Utility classes (11 classes) | ~33 |
| Keyframes + animation utilities | ~22 |
| Comments | ~3 |
| **Total** | **~100 lines** |

## References

- Globals CSS: `packages/ui/src/globals.css`
- Consuming apps: `apps/app/src/styles/globals.css`, `apps/www/src/styles/globals.css`
- Remotion styles (out of scope): `packages/app-remotion/src/styles.css`
