---
date: 2026-03-09T13:21:38Z
researcher: Claude (claude-sonnet-4-6)
git_commit: 899a1c9eb
branch: chore/biome-group-1-rule-enablement
repository: lightfast
topic: "Biome-Ignore Audit — Proper Fixes for Group 1 Rule Suppressions"
tags: [research, biome, lint, a11y, accessibility, code-quality, jsx, aria]
status: complete
last_updated: 2026-03-09
last_updated_by: Claude (claude-sonnet-4-6)
last_updated_note: "Revised after discovering biome.jsonc excludes packages/ui/src/components/ui/"
---

# Research: Biome-Ignore Audit — Proper Fixes for Group 1 Rule Suppressions

**Date**: 2026-03-09T13:21:38Z
**Git Commit**: 899a1c9eb
**Branch**: chore/biome-group-1-rule-enablement
**Repository**: lightfast

## Research Question

After enabling 14 Biome Group 1 lint rules, ~15 `biome-ignore` suppressions and 3 Fragment wrapper hacks were added. Audit each suppression to determine whether a proper code fix exists that eliminates the need for suppression entirely.

## Important: Biome Config Exclusions

`biome.jsonc` (lines 8-10) excludes these directories from linting:
```jsonc
"!packages/ui/src/components/ui",
"!packages/ui/src/hooks",
"!packages/ui/src/lib",
```

This means **4 items from the original audit are moot** — Biome never lints them, so their
`biome-ignore` comments are inert dead code:
- ~~1b~~ `breadcrumb.tsx` — excluded (in `packages/ui/src/components/ui/`)
- ~~1c~~ `input-otp.tsx` — excluded
- ~~2b~~ `sidebar.tsx` — excluded
- ~~2c~~ `calendar.tsx` — excluded

Their `biome-ignore` comments are harmless but do nothing. The proper fixes documented below
remain valid for code quality / a11y correctness, but are **not required** to satisfy Biome.

## Summary

Of the **11 items where Biome actually lints**, 5 have proper fixes, 5 suppressions are
justified, and 1 suppression is unnecessary (dead `biome-ignore` for a rule that doesn't
fire on `onError`).

### Active Items (Biome lints these files)

| Item | Rule | Verdict | Effort | Risk |
|---|---|---|---|---|
| 1a workspace-search.tsx | noNoninteractiveElementInteractions | PROPER_FIX_EXISTS | S | LOW |
| 2a pitch-deck-context.tsx | noDocumentCookie (×2) | SUPPRESSION_JUSTIFIED | — | — |
| 2d reset-demo.ts + seed-integrations.ts | useForOf | PROPER_FIX_EXISTS | M | LOW |
| 2e inline-citation.tsx | noNoninteractiveElementInteractions | UNNECESSARY (remove it) | S | LOW |
| 2e inline-citation.tsx | noImgElement | SUPPRESSION_JUSTIFIED | — | — |
| 2f next-image.tsx mock | noImgElement | SUPPRESSION_JUSTIFIED | — | — |
| 2g prompt-input.tsx | noImgElement | SUPPRESSION_JUSTIFIED | — | — |
| 3a backfill-orchestrator.ts | noControlCharactersInRegex | SUPPRESSION_JUSTIFIED | — | — |
| 3b tier3.ts | noGlobalEval | PROPER_FIX_EXISTS | S | LOW |
| 3c satori.d.ts | noNamespace | PROPER_FIX_EXISTS | S | LOW |
| 3d Root.tsx (remotion) | useFilenamingConvention | SUPPRESSION_JUSTIFIED | — | — |

### Excluded Items (Biome does NOT lint these — `biome-ignore` is inert)

| Item | Rule | Status |
|---|---|---|
| ~~1b~~ breadcrumb.tsx | useFocusableInteractive | EXCLUDED — biome-ignore is dead code (proper a11y fix documented below for reference) |
| ~~1c~~ input-otp.tsx | useAriaPropsForRole + useFocusableInteractive | EXCLUDED — biome-ignore is dead code (proper a11y fix documented below for reference) |
| ~~2b~~ sidebar.tsx | noDocumentCookie | EXCLUDED — biome-ignore is dead code |
| ~~2c~~ calendar.tsx | noNestedComponentDefinitions (×3) | EXCLUDED — biome-ignore is dead code (extraction fix documented below for reference) |

---

## Detailed Findings

### Priority 1: Fragment Wrapper Hacks

These use Fragment wrappers added solely to place `{/* biome-ignore */}` comment nodes before
root JSX (because `//` comments before root JSX break TypeScript parsing).

> **Note**: Items 1b and 1c are in `packages/ui/src/components/ui/` which is excluded from Biome
> linting in `biome.jsonc`. Their `biome-ignore` comments are inert. The fixes below are
> documented for code quality / a11y correctness, not Biome compliance.

---

#### 1a. `apps/console/src/components/workspace-search.tsx`

**Rule**: `noNoninteractiveElementInteractions`
**Violation**: `<div role="search" onKeyDown={handleKeyDown}>` (line 208)

**Current state**: Entire return wrapped in `<>...</>` to place comment before the root `<div>`.
The `handleKeyDown` captures `Cmd+Enter` / `Ctrl+Enter` to submit the search form.

**What the rule enforces**: Biome's `noNoninteractiveElementInteractions` flags `onKeyDown`,
`onClick`, `onMouseDown`, `onMouseUp`, `onKeyPress`, `onKeyUp` on non-interactive elements.
Landmark roles like `role="search"`, `role="main"`, `role="navigation"` are classified as
**non-interactive** — only `role="button"`, `role="link"`, etc. are interactive. So placing
`onKeyDown` on `role="search"` triggers the rule correctly.

**Proper fix**: Replace `<div role="search">` with the HTML5 `<search>` semantic element.
The `<search>` element has implicit `role="search"` semantics but Biome checks for the
**explicit `role` attribute**, not the implicit role derived from the element tag. Using `<search>`
without the `role` attribute bypasses the rule entirely while preserving full semantics.

```tsx
// Before (Fragment hack)
return (
  <>
    {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: ... */}
    <div
      className="flex h-full flex-col overflow-hidden"
      onKeyDown={handleKeyDown}
      role="search"
    >
      ...
    </div>
  </>
);

// After (clean, no suppression)
return (
  <search
    className="flex h-full flex-col overflow-hidden"
    onKeyDown={handleKeyDown}
  >
    ...
  </search>
);
```

`<search>` is valid HTML5 (baseline since 2023, supported in all modern browsers). React supports
it natively. The `onKeyDown` handler is semantically justified on a `<search>` element since it
captures keyboard shortcuts for the search form.

**Alternative**: Refactor `handleKeyDown` to use `window.addEventListener('keydown', ...)` in a
`useEffect` (the same pattern used in `SidebarProvider` and `PitchDeckProvider`). This is
arguably cleaner but has a broader scope (captures events even when search is not focused).

**Verdict**: PROPER_FIX_EXISTS
**Effort**: S (< 5 min — change `<div role="search">` to `<search>`, remove Fragment)
**Risk**: LOW (purely structural, no behavior change)

---

#### 1b. `packages/ui/src/components/ui/breadcrumb.tsx` — `BreadcrumbPage` ⚠️ EXCLUDED FROM BIOME

**Rule**: `useFocusableInteractive`
**Violation**: `<span role="link" aria-disabled="true" aria-current="page">` (line 55)

**Current state**: `BreadcrumbPage` return wrapped in `<>...</>` to place the comment. The span
uses `role="link"` on a non-focusable element.

**What the rule enforces**: `useFocusableInteractive` requires elements with interactive roles
(`role="link"`, `role="button"`, etc.) to be keyboard-focusable (have `tabIndex`). A `<span>`
with `role="link"` and no `tabIndex` creates a phantom link that screen readers announce but
users can never activate — a genuine WCAG 4.1.2 violation.

**Research finding**: This is a real accessibility bug. The WAI-ARIA APG breadcrumb pattern
explicitly states: "If the element representing the current page is not a link, `aria-current`
is optional." The current page indicator in a breadcrumb **should not** be a link at all.
shadcn/ui PR [#7804](https://github.com/shadcn-ui/ui/pull/7804) (open, not yet merged) proposes
the exact same fix. Issue [#7639](https://github.com/shadcn-ui/ui/issues/7639) confirms this is
a genuine a11y bug in the upstream shadcn component.

Additionally, `aria-disabled="true"` is only meaningful on interactive roles. On a plain `<span>`
without an interactive role, it has no semantic effect and should also be removed.

**Proper fix**: Remove `role="link"` and `aria-disabled="true"`. Keep `aria-current="page"`.

```tsx
// Before (Fragment hack + accessibility bug)
function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <>
      {/* biome-ignore lint/a11y/useFocusableInteractive: ... */}
      <span
        aria-current="page"
        aria-disabled="true"
        className={cn("font-normal text-foreground", className)}
        data-slot="breadcrumb-page"
        role="link"
        {...props}
      />
    </>
  );
}

// After (clean, no suppression, correct a11y)
function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      data-slot="breadcrumb-page"
      {...props}
    />
  );
}
```

**Verdict**: PROPER_FIX_EXISTS
**Effort**: S (< 5 min — remove two attributes, remove Fragment)
**Risk**: LOW (improves accessibility, no component API change)

---

#### 1c. `packages/ui/src/components/ui/input-otp.tsx` — `InputOTPSeparator` ⚠️ EXCLUDED FROM BIOME

**Rules**: `useAriaPropsForRole` + `useFocusableInteractive`
**Violation**: `<div role="separator" {...props}>` (line 95)

**Current state**: Return wrapped in `<>...</>` to place two biome-ignore comments. The separator
uses `role="separator"` which triggers two rules.

**What the rules enforce**:
- `useAriaPropsForRole`: `role="separator"` (when focusable) requires `aria-valuenow`. Biome
  flags this statically without checking focusability.
- `useFocusableInteractive`: `role="separator"` (when used as an interactive splitter widget)
  requires keyboard focus. Again flagged statically.

**Research finding**: WAI-ARIA 1.2 distinguishes two separator types. A **non-focusable
separator** (decorative visual element like an OTP dash) requires **no** ARIA attributes. Only a
**focusable separator** (interactive resizable splitter pane) requires `aria-valuenow`. Biome
can't determine focusability statically, so it flags `role="separator"` on any element — this is
a known tool limitation. The OTP separator is purely decorative.

**Proper fix**: Change `role="separator"` to `role="none"` (alias: `role="presentation"`), which
removes the element from the accessibility tree entirely (correct for a decorative visual element).
Alternatively, add `aria-hidden="true"` (same effect, consistent with `BreadcrumbSeparator`
and `BreadcrumbEllipsis` which both use `aria-hidden="true"` in the same file).

```tsx
// Before (Fragment hack + two biome-ignores)
function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <>
      {/* biome-ignore lint/a11y/useAriaPropsForRole: ... */}
      {/* biome-ignore lint/a11y/useFocusableInteractive: ... */}
      <div data-slot="input-otp-separator" role="separator" {...props}>
        <MinusIcon />
      </div>
    </>
  );
}

// After Option A — role="none" (cleanest semantically)
function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="none" {...props}>
      <MinusIcon />
    </div>
  );
}

// After Option B — aria-hidden="true" (consistent with BreadcrumbSeparator pattern)
function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div aria-hidden="true" data-slot="input-otp-separator" {...props}>
      <MinusIcon />
    </div>
  );
}
```

Note: `{...props}` could spread `role` and override the fix if callers pass `role`. Since
`InputOTPSeparator` is a UI library component, this is an acceptable trade-off. Option B
(`aria-hidden`) is recommended for consistency with the breadcrumb separator pattern.

**Verdict**: PROPER_FIX_EXISTS
**Effort**: S (< 5 min — change role attr, remove Fragment, remove two suppression comments)
**Risk**: LOW (purely accessibility attribute change, no visual change)

---

### Priority 2: Potentially Fixable Suppressions

---

#### 2a. `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx` (×2)

**Rule**: `noDocumentCookie`
**Violation**: `document.cookie = \`${PREFACE_COOKIE_NAME}=${expanded}; path=/; max-age=${PREFACE_COOKIE_MAX_AGE}\`` (lines 59, 67)

**Current state**: Two separate `document.cookie =` assignments in `setPrefaceExpanded` and
`togglePreface` callbacks. Both persist user preference for pitch deck preface expand/collapse.

**Research**: The `noDocumentCookie` rule recommends the Cookie Store API (`cookieStore.set()`).
However, Cookie Store API is Chrome/Edge-only (Firefox support is limited as of 2026). No
cookie utility exists in `@repo/lib` or `@vendor/*` monorepo packages. The `localStorage`
alternative would work if no server-side rendering reads this preference — and looking at the
code, the pitch deck page appears to be a client-only interactive view with no SSR using the
cookie, making `localStorage` viable. However, the cookie naming convention matches the sidebar
pattern which IS read server-side.

**Verdict**: SUPPRESSION_JUSTIFIED
- Cookie Store API has insufficient browser support
- `localStorage` may be viable but requires verifying no SSR reads the cookie
- The pattern is consistent with `sidebar.tsx` which uses the same approach
- Suppression comment is correctly placed and accurately describes the situation

**Effort**: N/A | **Risk**: N/A

---

#### 2b. `packages/ui/src/components/ui/sidebar.tsx` ⚠️ EXCLUDED FROM BIOME

**Rule**: `noDocumentCookie`
**Violation**: `document.cookie = \`${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}\`` (line 88)

**Current state**: Sidebar state is persisted to `document.cookie` in the `setOpen` callback.
This is necessary because Next.js server components (in `apps/console`) read the sidebar cookie
to determine the initial `open` prop, avoiding layout shift on first render.

**Research**: The sidebar cookie (`sidebar_state`) is explicitly designed to be read server-side
for SSR. `localStorage` cannot be accessed server-side. The Cookie Store API lacks broad browser
support. The `document.cookie` API is the correct mechanism for client-side writes of SSR-readable
cookies. This is the standard shadcn/ui pattern.

**Verdict**: SUPPRESSION_JUSTIFIED (must use cookies for SSR compatibility; no viable alternative)
**Effort**: N/A | **Risk**: N/A

---

#### 2c. `packages/ui/src/components/ui/calendar.tsx` (×3) ⚠️ EXCLUDED FROM BIOME

**Rule**: `noNestedComponentDefinitions`
**Violation**: Inline `Root`, `Chevron`, `WeekNumber` component definitions in `components={{...}}` (lines 122–164)

**Current state**: Three components defined inline as arrow functions within the `components` prop
of `<DayPicker>`. `CalendarDayButton` is correctly extracted as a named top-level component.

**What the rule enforces**: `noNestedComponentDefinitions` prevents React components from being
defined inside render functions. Inline definitions create a new component reference on every
render, causing React to unmount/remount instead of rerender, which destroys DOM state and is
a performance/correctness issue.

**Research finding**: All three components (`Root`, `Chevron`, `WeekNumber`) **access no parent
scope variables**. Contrary to the suppression comment ("react-day-picker API requires inline
component definitions"), there is no such API requirement. react-day-picker accepts any React
component as a prop — extracted or inline. The `defaultClassNames` variable is NOT captured by
any of the three inline components:
- `Root` uses `className` (passed as a prop), not `defaultClassNames`
- `Chevron` uses `className` and `orientation` props only
- `WeekNumber` uses `children` prop only

Type signatures (from `react-day-picker@9.14.0`):
- `RootProps = { rootRef?: Ref<HTMLDivElement> } & HTMLAttributes<HTMLDivElement>`
- `ChevronProps = { className?: string; size?: number; disabled?: boolean; orientation?: "up" | "down" | "left" | "right" }`
- `WeekNumberProps = { week: CalendarWeek } & ThHTMLAttributes<HTMLTableCellElement>`

All types are exported from `react-day-picker` directly.

**Proper fix**: Extract all three to top-level named components before the `Calendar` function.

```tsx
// Add before function Calendar(...) { ... }

import type { ChevronProps, RootProps, WeekNumberProps } from "react-day-picker";

function CalendarRoot({ className, rootRef, ...props }: RootProps) {
  return (
    <div className={cn(className)} data-slot="calendar" ref={rootRef} {...props} />
  );
}

function CalendarChevron({ className, orientation, ...props }: ChevronProps) {
  if (orientation === "left") {
    return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
  }
  if (orientation === "right") {
    return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
  }
  return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
}

function CalendarWeekNumber({ children, ...props }: WeekNumberProps) {
  return (
    <td {...props}>
      <div className="flex size-(--cell-size) items-center justify-center text-center">
        {children}
      </div>
    </td>
  );
}

// Then in Calendar, replace inline definitions:
components={{
  Root: CalendarRoot,
  Chevron: CalendarChevron,
  DayButton: CalendarDayButton,
  WeekNumber: CalendarWeekNumber,
  ...components,
}}
```

Note: `ChevronProps` is a narrow custom type (not `SVGProps`). Spreading `...props` into lucide
icons may pass `disabled` and `size` as unknown DOM attributes — this is the same behavior as
today's inline code (shadcn upstream has the same issue).

**Verdict**: PROPER_FIX_EXISTS
**Effort**: M (5-30 min — extract 3 functions, add type imports)
**Risk**: LOW (no behavioral change; React will reconcile normally with stable component refs)

---

#### 2d. `packages/console-test-data/src/cli/reset-demo.ts` + `seed-integrations.ts`

**Rule**: `useForOf`
**Violation**: `for (let i = 0; i < args.length; i++)` with `args[++i]` for flag parsing (reset-demo.ts:174, seed-integrations.ts:168)

**Current state**: Both CLI scripts hand-roll argument parsing using index mutation (`args[++i]`
to consume the next argument as a value). The `useForOf` rule prefers `for...of` but `args[++i]`
is genuinely incompatible with `for...of`.

**Suppression comment reasoning**: "requires index mutation (args[++i]) for flag parsing" — this
is technically correct. `for...of` iterates values only, with no index access.

**Proper fix**: Replace manual arg parsing with `node:util`'s `parseArgs`, which is built-in
since Node.js 18.3+ (this monorepo requires Node.js 22+). Eliminates the loop entirely.

```typescript
import { parseArgs } from "node:util";

function parseCliArgs(): ResetOptions {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      workspace: { type: "string", short: "w" },
      inject: { type: "boolean", short: "i" },
      "dry-run": { type: "boolean" },
    },
    strict: false,
  });

  return {
    workspaceId: values.workspace ?? "",
    inject: values.inject ?? false,
    dryRun: values["dry-run"] ?? false,
  };
}
```

For `seed-integrations.ts`, similarly replace with `parseArgs` for `-w`/`--workspace` and
`-u`/`--user` flags.

Note: The current suppression IS technically justified for the `for (let i...)` approach — you
genuinely cannot use `for...of` with index mutation. The suppression comment is correctly placed.
But the proper solution is to eliminate the loop entirely via `parseArgs`.

**Verdict**: PROPER_FIX_EXISTS (via `parseArgs`), SUPPRESSION_JUSTIFIED (for current approach)
**Effort**: M (5-30 min — refactor both scripts)
**Risk**: LOW (CLI scripts only, zero user-facing impact)

---

#### 2e. `packages/ui/src/components/ai-elements/inline-citation.tsx`

**Rules**: `noNoninteractiveElementInteractions` (line 85) + `noImgElement` (line 86)
**Violation**: `<img onError={...}>` for favicon thumbnails (line 88)

**Critical finding**: The `noNoninteractiveElementInteractions` suppression is **UNNECESSARY**.

Biome's `noNoninteractiveElementInteractions` only flags these 6 handlers: `onClick`,
`onMouseDown`, `onMouseUp`, `onKeyPress`, `onKeyDown`, `onKeyUp`. `onError` is a **resource
loading event**, not a user interaction handler. The rule does not flag `onError` on any element.
The biome-ignore comment for `noNoninteractiveElementInteractions` should be removed — it
suppresses a rule that isn't firing on this code.

**For `noImgElement`**: This rule prefers `next/image` over `<img>`. The UI package
(`packages/ui`) is framework-agnostic and has no `next/image` dependency. Suppression is
justified — it cannot use `next/image`.

**Proper fix for the unnecessary suppression**: Remove the `noNoninteractiveElementInteractions`
biome-ignore line. Keep the `noImgElement` suppression.

```tsx
// Before (two suppressions, one unnecessary):
// biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is a load handler, not user interaction
// biome-ignore lint/performance/noImgElement: UI package is framework-agnostic, no next/image
// biome-ignore lint/correctness/useImageSize: favicon thumbnails with fixed CSS dimensions
<img onError={...} ... />

// After (one suppression removed):
// biome-ignore lint/performance/noImgElement: UI package is framework-agnostic, no next/image
// biome-ignore lint/correctness/useImageSize: favicon thumbnails with fixed CSS dimensions
<img onError={...} ... />
```

**Verdict for noNoninteractiveElementInteractions**: UNNECESSARY — remove the suppression
**Verdict for noImgElement**: SUPPRESSION_JUSTIFIED
**Effort**: S (< 5 min — delete one line)
**Risk**: LOW

---

#### 2f. `apps/console/src/__tests__/__mocks__/next-image.tsx`

**Rule**: `noImgElement` (line 7)
**Violation**: Test mock renders `<img>` to stub `next/image` (line 8)

**Current state**: This is the Jest mock file for `next/image`. It renders a plain `<img>` element
with all props passed through.

**Analysis**: A mock of `next/image` cannot use `next/image` itself — that would create infinite
recursion. The `<img>` element is the only correct implementation for a test stub that renders
something real. Suppression is correct.

**Alternative**: Biome config could exclude `__mocks__/` directories via `files.ignore` patterns,
removing the need for inline suppression:
```json
// biome.json
{
  "files": {
    "ignore": ["**/__mocks__/**"]
  }
}
```
This would also suppress `useAltText` and `useImageSize` on the same element.

**Verdict**: SUPPRESSION_JUSTIFIED (inline suppression correct; Biome config exclusion is a
cleaner alternative if the pattern appears in more test files)
**Effort**: N/A | **Risk**: N/A

---

#### 2g. `packages/ui/src/components/ai-elements/prompt-input.tsx`

**Rule**: `noImgElement` (line 138)
**Violation**: `<img>` for attachment image thumbnails (line 139)

**Current state**: `PromptInputAttachment` renders `<img>` for image attachment previews with
fixed `height={56}` and `width={56}` dimensions.

**Analysis**: The UI package is framework-agnostic. `next/image` cannot be imported here without
coupling the UI package to Next.js. The suppression is correct.

A pattern used by some UI libraries (e.g., Shadcn's `<Avatar>`) is to accept an `ImageComponent`
prop for framework-specific rendering. This would allow console to pass `next/image` while
keeping the package generic. However, this changes the component API and is out of scope for a
lint fix.

**Verdict**: SUPPRESSION_JUSTIFIED
**Effort**: N/A | **Risk**: N/A

---

### Priority 3: Likely Justified Suppressions (Verified)

---

#### 3a. `apps/backfill/src/workflows/backfill-orchestrator.ts`

**Rule**: `noControlCharactersInRegex`
**Violation**: `/[\x00-\x1f]/g` (line 163)

**Current state**: The `celEscape` function escapes control characters (Unicode code points 0–31)
in strings that will be embedded into CEL (Common Expression Language) expression strings for
Inngest's `waitForEvent` `if` conditions. The regex correctly matches all ASCII control
characters.

**Analysis**: The `noControlCharactersInRegex` rule warns against accidental control characters
in regex literals. Here the control characters are **intentional** — they define the exact range
to escape. No library function in the monorepo or standard library provides this exact
functionality without a regex. The `\x00-\x1f` notation is explicit, intentional, and correct.

Alternative named character class: `\p{Cc}` (Unicode General Category Control) would match all
Unicode control characters (including those > U+001F) — broader than intended. The current range
is deliberate.

**Verdict**: SUPPRESSION_JUSTIFIED — the regex is intentionally matching control characters
**Effort**: N/A | **Risk**: N/A

---

#### 3b. `packages/tech-stack-detector/src/tiers/tier3.ts`

**Rule**: `noGlobalEval`
**Violation**: `eval(name)` inside `page.evaluate()` callback (line 86)

**Current state**: Detects JavaScript globals in target websites by calling `eval(name)` where
`name` is a string like `"React"`, `"angular"`, `"__NEXT_DATA__"`, `"Intercom"`. The code runs
inside a Playwright `page.evaluate()` call — it executes in the browser's JavaScript sandbox,
not in Node.js.

**Research finding**: `typeof window[name] !== "undefined"` (or `typeof globalThis[name]`) is a
safe replacement for `typeof eval(name) !== "undefined"` for all current globals in the registry.
All library globals are set via `window.X = ...` or `var X = ...`, so they appear as properties
of `window`/`globalThis`. The `eval` approach can detect `const`/`let` top-level globals that
`window[name]` cannot, but no real library declares itself with `const` at global script scope.

**Proper fix**: Replace `eval(name)` with `globalThis[name]`:

```typescript
// Before (requires biome-ignore)
const globalResults = await page.evaluate((names: string[]) => {
  return names.map((name) => {
    try {
      // biome-ignore lint/security/noGlobalEval: eval runs inside Playwright browser sandbox
      return typeof eval(name) !== "undefined";
    } catch {
      return false;
    }
  });
}, globalNames);

// After (clean, no suppression)
const globalResults = await page.evaluate((names: string[]) => {
  return names.map((name) => typeof globalThis[name] !== "undefined");
}, globalNames);
```

`typeof globalThis[name]` never throws (property access on an object cannot throw for undefined
properties). The `try/catch` is no longer needed.

**Caveat**: If the registry ever adds dot-path globals like `"window.Intercom"` or
`"google.maps.Map"`, `globalThis["window.Intercom"]` would incorrectly return `undefined`. The
current registry only uses single-identifier strings, so this is not a current concern.

**Verdict**: PROPER_FIX_EXISTS
**Effort**: S (< 5 min — replace `eval(name)` with `globalThis[name]`, remove try/catch)
**Risk**: LOW (same behavior for all current registry globals)

---

#### 3c. `packages/og/src/satori.d.ts`

**Rule**: `noNamespace`
**Violation**: `declare namespace React` (line 2)

**Current state**: A 6-line `.d.ts` file that augments React's `HTMLAttributes<T>` to add the
`tw` prop used by satori for Tailwind-in-OG-images.

```ts
// biome-ignore lint/style/noNamespace: required for satori React HTMLAttributes augmentation
declare namespace React {
  interface HTMLAttributes<_T> {
    tw?: string;
  }
}
```

**Research finding**: `declare module 'react'` is the correct TypeScript module augmentation
pattern and is **explicitly valid** in Biome's `noNamespace` rule (the docs list
`declare module 'foo' {}` with quoted string as a valid pattern, while `declare namespace foo {}`
and `declare module foo {}` without quotes are invalid).

The file has no imports or exports — to make `declare module 'react'` work as a module
augmentation (not an ambient module replacement), the file must have at least one module-level
`import` or `export`. Adding `export {}` is the standard fix.

**Proper fix**:

```ts
// satori.d.ts — no suppression needed
export {};

declare module 'react' {
  interface HTMLAttributes<T> {
    tw?: string;
  }
}
```

`export {}` makes the file a module (not a script), which enables TypeScript to treat
`declare module 'react'` as a merging augmentation rather than a replacement. This is the
pattern used by twin.macro (which also adds `tw` to `HTMLAttributes`) and recommended by
DefinitelyTyped maintainers.

Satori has no official TypeScript documentation for this pattern — the community workaround
above is the established approach.

**Verdict**: PROPER_FIX_EXISTS
**Effort**: S (< 5 min — two-line change)
**Risk**: LOW (TypeScript type change only, no runtime impact)

---

#### 3d. `packages/console-remotion/src/Root.tsx`

**Rule**: `useFilenamingConvention`
**Violation**: PascalCase filename `Root.tsx` (line 1 suppression)

**Current state**: Remotion's build entry point is canonically named `Root.tsx`. The
`useFilenamingConvention` rule prefers kebab-case filenames.

**Analysis**: Remotion's documentation requires the entry file to be specified explicitly in the
Remotion config (`remotion.config.ts`), so the filename itself is not technically mandated by
Remotion. However, `Root.tsx` containing `RemotionRoot` as the export is the universal Remotion
convention and changing it would require updating all Remotion scaffolding references.

**Verdict**: SUPPRESSION_JUSTIFIED (Remotion convention; changing would require scaffolding updates)
**Effort**: N/A | **Risk**: N/A

---

## Code References

- `apps/console/src/components/workspace-search.tsx:204-294` — Fragment wrapper hack with `role="search"` + `onKeyDown`
- `packages/ui/src/components/ui/breadcrumb.tsx:51-65` — `BreadcrumbPage` Fragment hack
- `packages/ui/src/components/ui/input-otp.tsx:90-100` — `InputOTPSeparator` Fragment hack with 2 suppressions
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx:59,67` — `noDocumentCookie` suppressions
- `packages/ui/src/components/ui/sidebar.tsx:88` — `noDocumentCookie` suppression
- `packages/ui/src/components/ui/calendar.tsx:122-164` — 3 inline `noNestedComponentDefinitions`
- `packages/console-test-data/src/cli/reset-demo.ts:174` — `useForOf` suppression
- `packages/console-test-data/src/cli/seed-integrations.ts:168` — `useForOf` suppression
- `packages/ui/src/components/ai-elements/inline-citation.tsx:85-88` — unnecessary `noNoninteractiveElementInteractions` + justified `noImgElement`
- `apps/console/src/__tests__/__mocks__/next-image.tsx:7-8` — `noImgElement` suppression
- `packages/ui/src/components/ai-elements/prompt-input.tsx:138-139` — `noImgElement` suppression
- `apps/backfill/src/workflows/backfill-orchestrator.ts:162-163` — `noControlCharactersInRegex`
- `packages/tech-stack-detector/src/tiers/tier3.ts:85-86` — `noGlobalEval`
- `packages/og/src/satori.d.ts:1-6` — `noNamespace`
- `packages/console-remotion/src/Root.tsx:1` — `useFilenamingConvention`

## Architecture Documentation

### Pattern: Fragment Wrapper Anti-Pattern

All three Priority 1 items use this anti-pattern:
```tsx
return (
  <>
    {/* biome-ignore ... */}
    <ActualRootElement>...</ActualRootElement>
  </>
);
```

This changes the component's return structure unnecessarily (adding a Fragment wrapper), exists
solely as a `// biome-ignore`-comment carrier, and in all three cases the underlying issue has a
proper semantic fix. After fixing all three, zero Fragment wrappers remain.

### Pattern: Biome noNoninteractiveElementInteractions Event List

The rule only fires for: `onClick`, `onMouseDown`, `onMouseUp`, `onKeyPress`, `onKeyDown`, `onKeyUp`.
It does NOT fire for: `onError`, `onLoad`, `onFocus`, `onBlur`, `onChange`, `onScroll`, and all
other resource/lifecycle events.

### Cookie Pattern — SSR Compatibility

`sidebar.tsx` must use `document.cookie` because server components read the cookie for SSR. The
Cookie Store API is not broadly available. This suppression is the correct approach. Consider
creating a shared `cookieSet(name, value, maxAge)` utility in `@repo/lib` for reuse across
sidebar and pitch-deck contexts.

## Open Questions

1. Does `PitchDeckProvider` read the cookie server-side? If not, `localStorage` is viable for
   the pitch-deck preference, which would eliminate one `noDocumentCookie` suppression.
2. For `seed-integrations.ts`, `parseArgs` refactor should also update the help text (which
   currently mentions `args[++i]` style parsing implicitly).
3. For `inline-citation.tsx`: after removing the unnecessary `noNoninteractiveElementInteractions`
   suppression, verify Biome doesn't introduce a false positive for `onError` in a future version.
4. Consider adding `**/__mocks__/**` to Biome's `files.ignore` to clean up the test mock
   suppressions (`noImgElement`, `useAltText`, `useImageSize`).

## Prioritized Fix Order

### Active fixes (Biome actually lints these files)

**Immediate (S effort, low risk — do these first):**
1. `1a` — Change `<div role="search">` to `<search>` + remove Fragment from `WorkspaceSearch`
2. `2e` — Remove unnecessary `noNoninteractiveElementInteractions` from `inline-citation.tsx`
3. `3b` — Replace `eval(name)` with `globalThis[name]` in `tier3.ts`
4. `3c` — Replace `declare namespace React` with `declare module 'react'` in `satori.d.ts`

**Medium (M effort, low risk — do these next):**
5. `2d` — Refactor both CLI scripts to use `node:util parseArgs`

### Optional fixes (Biome-excluded files — fix for code quality, not lint compliance)

These files are in `packages/ui/src/components/ui/` which `biome.jsonc` excludes. The
`biome-ignore` comments are inert dead code. Fixes improve code quality / a11y but are not
required for lint compliance.

6. `1b` — Remove `role="link"` + `aria-disabled` + Fragment from `BreadcrumbPage` (a11y fix)
7. `1c` — Change `role="separator"` to `role="none"` + remove Fragment from `InputOTPSeparator` (a11y fix)
8. `2c` — Extract `Root`, `Chevron`, `WeekNumber` as top-level components in `calendar.tsx` (React perf fix)

Note: Items 2b (sidebar.tsx `noDocumentCookie`) is both excluded AND justified — no action needed.
