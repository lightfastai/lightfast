# Biome Group 1 — Suppression Fixes Implementation Plan

## Overview

After enabling 14 Biome Group 1 lint rules (commit `899a1c9eb`), ~10 `biome-ignore` suppressions and 1 Fragment wrapper hack were added across actively-linted files. This plan implements proper code fixes for the 5 items that have clean alternatives, removes 1 unnecessary suppression, and optionally fixes 2 accessibility bugs in Biome-excluded UI files.

**Research**: `thoughts/shared/research/2026-03-09-biome-ignore-audit-group1-suppressions.md`

## Current State Analysis

### Active Suppressions (Biome lints these files)

| # | File | Rule | Current | Action |
|---|---|---|---|---|
| 1a | workspace-search.tsx | noNoninteractiveElementInteractions | Fragment hack + `<div role="search">` | Change to `<search>` |
| 2e | inline-citation.tsx | noNoninteractiveElementInteractions | Suppression on `onError` handler | Verify + remove if unnecessary |
| 3b | tier3.ts | noGlobalEval | `eval(name)` in browser sandbox | Replace with `globalThis[name]` |
| 3c | satori.d.ts | noNamespace | `declare namespace React` | Use `declare module 'react'` |
| 2d | reset-demo.ts | useForOf | Manual `for (let i...)` arg parsing | Use `node:util parseArgs` |
| 2d | seed-integrations.ts | useForOf | Manual `for (let i...)` arg parsing | Use `node:util parseArgs` |

### Justified Suppressions (no action needed)

| File | Rule | Reason |
|---|---|---|
| pitch-deck-context.tsx (×2) | noDocumentCookie | Cookie Store API insufficient browser support |
| next-image.tsx mock | noImgElement | Mock cannot use `next/image` |
| prompt-input.tsx | noImgElement | UI package is framework-agnostic |
| inline-citation.tsx | noImgElement | UI package is framework-agnostic |
| backfill-orchestrator.ts | noControlCharactersInRegex | Intentional control char matching |
| Root.tsx | useFilenamingConvention | Remotion convention |

### Biome-Excluded Files (optional fixes for code quality)

| # | File | Issue | Action |
|---|---|---|---|
| 1b | breadcrumb.tsx | `role="link"` on non-focusable span (a11y bug) | Remove `role="link"` + `aria-disabled` |
| 1c | input-otp.tsx | `role="separator"` on decorative element | Change to `aria-hidden="true"` |

## Desired End State

- 5 `biome-ignore` suppressions removed from actively-linted files
- 1 Fragment wrapper hack eliminated
- 2 accessibility bugs fixed in UI components (optional)
- `pnpm check` and `pnpm typecheck` pass cleanly

## What We're NOT Doing

- **calendar.tsx extraction**: Inline `Root`, `Chevron`, `WeekNumber` components could be extracted, but the file is Biome-excluded and the effort is M. Deferred.
- **sidebar.tsx cookie**: `document.cookie` is required for SSR. Suppression justified.
- **pitch-deck-context.tsx cookie**: Same pattern as sidebar. Suppression justified.
- **Adding `**/__mocks__/**` to Biome excludes**: Could clean up test mock suppressions but is a config change beyond this scope.

## Implementation Approach

Each phase applies changes, then verifies with `pnpm check` and `pnpm typecheck`. Phase 1 contains independent small fixes that can be applied atomically. Phase 2 is a slightly larger refactor. Phase 3 is optional.

---

## Phase 1: Quick Lint Fixes (S effort)

### Overview

Four independent small fixes in actively-linted files. Each removes a `biome-ignore` suppression by fixing the underlying code.

### Changes Required:

#### 1a. `apps/console/src/components/workspace-search.tsx` — `<search>` element

**File**: `apps/console/src/components/workspace-search.tsx`
**Lines**: 203-210

**Change**: Replace `<div role="search">` with the HTML5 `<search>` element. Remove the Fragment wrapper. **Fallback applied**: `<search>` still triggers the rule, so biome-ignore suppression kept (as `//` comment, no Fragment needed).

**Outcome**: Fragment hack eliminated, semantic HTML improved. Suppression remains but is now a simple `//` comment instead of a Fragment wrapper hack.

```tsx
// Before (lines 203-210):
return (
  <>
    {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: search landmark captures keyboard events for the search form */}
    <div
      className="flex h-full flex-col overflow-hidden"
      onKeyDown={handleKeyDown}
      role="search"
    >
      ...
    </div>
  </>
);

// After:
return (
  <search
    className="flex h-full flex-col overflow-hidden"
    onKeyDown={handleKeyDown}
  >
    ...
  </search>
);
```

Also update the closing tag at line ~294 from `</div>` to `</search>`.

**Fallback**: If `pnpm check` still flags `<search onKeyDown={...}>`:
```tsx
return (
  // biome-ignore lint/a11y/noNoninteractiveElementInteractions: search landmark captures keyboard events for the search form
  <search
    className="flex h-full flex-col overflow-hidden"
    onKeyDown={handleKeyDown}
  >
    ...
  </search>
);
```
This still removes the Fragment hack and improves semantics, even if the suppression remains.

---

#### 2e. `packages/ui/src/components/ai-elements/inline-citation.tsx` — Suppression retained

**File**: `packages/ui/src/components/ai-elements/inline-citation.tsx`
**Line**: 85

**Change**: No change. The research claim was wrong — `noNoninteractiveElementInteractions` **does** fire on `onError`. The suppression is load-bearing and must stay.

**Outcome**: Suppression correctly retained. No action taken.

```tsx
// Before (lines 85-88):
// biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is a load handler, not user interaction
// biome-ignore lint/performance/noImgElement: UI package is framework-agnostic, no next/image
// biome-ignore lint/correctness/useImageSize: favicon thumbnails with fixed CSS dimensions
<img

// After (lines 85-87):
// biome-ignore lint/performance/noImgElement: UI package is framework-agnostic, no next/image
// biome-ignore lint/correctness/useImageSize: favicon thumbnails with fixed CSS dimensions
<img
```

**Fallback**: If `pnpm check` fails, restore the suppression. The suppression is harmless even if unnecessary.

---

#### 3b. `packages/tech-stack-detector/src/tiers/tier3.ts` — Replace `eval` with `globalThis`

**File**: `packages/tech-stack-detector/src/tiers/tier3.ts`
**Lines**: 82-91

**Change**: Replace `eval(name)` with `globalThis[name]` inside the `page.evaluate()` callback. Remove the try/catch since property access on `globalThis` never throws. Remove the `biome-ignore` comment.

**Rationale**: All registry `global` values are bare identifiers (no dot-paths). `globalThis[name]` is a direct equivalent for simple identifiers. The try/catch was only needed because `eval()` of an undeclared identifier throws `ReferenceError`.

```typescript
// Before (lines 82-91):
const globalResults = await page.evaluate((names: string[]) => {
  return names.map((name) => {
    try {
      // biome-ignore lint/security/noGlobalEval: eval runs inside Playwright browser sandbox to detect globals
      return typeof eval(name) !== "undefined";
    } catch {
      return false;
    }
  });
}, globalNames);

// After:
const globalResults = await page.evaluate((names: string[]) => {
  return names.map((name) => typeof globalThis[name] !== "undefined");
}, globalNames);
```

---

#### 3c. `packages/og/src/satori.d.ts` — Module augmentation

**File**: `packages/og/src/satori.d.ts`
**Lines**: 1-6

**Change**: Replace `declare namespace React` with `declare module 'react'` and add `export {}` to make the file a TypeScript module.

**Rationale**: `declare module 'react'` with a quoted string is explicitly allowed by Biome's `noNamespace` rule. Adding `export {}` turns the file into a module, enabling TypeScript to treat `declare module 'react'` as a merging augmentation (not a full replacement).

> **Verification needed**: Must confirm TypeScript still picks up the `tw` prop on HTML elements after this change. Run `pnpm typecheck` and verify `packages/og/src/layouts/home.tsx` still compiles (it uses the `tw` prop).

```typescript
// Before (lines 1-6):
// biome-ignore lint/style/noNamespace: required for satori React HTMLAttributes augmentation
declare namespace React {
  interface HTMLAttributes<_T> {
    tw?: string;
  }
}

// After:
export {};

declare module "react" {
  interface HTMLAttributes<T> {
    tw?: string;
  }
}
```

Note: Changed `_T` to `T` since the underscore prefix for unused params is a convention that's unnecessary here — `T` is used by the interface declaration itself.

---

### Success Criteria:

#### Automated Verification:
- [x] Linting passes: `pnpm check`
- [x] Type checking passes: `pnpm typecheck` (116/116 tasks passed)
- [x] Specifically verify: `pnpm check` (workspace-search.tsx — passes with fallback suppression)
- [x] Specifically verify: `pnpm check` (inline-citation.tsx — suppression retained, passes)
- [x] Specifically verify: `pnpm check` (tier3.ts — passes)
- [x] Specifically verify: `pnpm check` (satori.d.ts — passes)
- [x] Specifically verify: `pnpm --filter @repo/og typecheck` (satori.d.ts TypeScript augmentation — passes)

#### Manual Verification:
- [ ] Workspace search keyboard shortcut (Cmd/Ctrl+Enter) still works in the console app
- [ ] Inline citation favicons still render and fallback on error
- [ ] Tech stack detector tier3 still detects globals correctly (run detector against a known site)
- [ ] OG image generation still renders correctly with `tw` prop

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: CLI Argument Parsing Refactor (M effort)

### Overview

Replace hand-rolled `for (let i...)` argument parsing with `node:util`'s built-in `parseArgs()` (available since Node.js 18.3+, this monorepo requires Node.js 22+). Eliminates both `useForOf` suppressions.

### Changes Required:

#### 2d-a. `packages/console-test-data/src/cli/reset-demo.ts`

**File**: `packages/console-test-data/src/cli/reset-demo.ts`
**Lines**: 165-200

**Change**: Replace the manual `parseArgs()` function with `node:util parseArgs`.

```typescript
// Before (lines 165-200):
function parseArgs(): ResetOptions {
  const args = process.argv.slice(2);
  const options: ResetOptions = {
    workspaceId: "",
    inject: false,
    dryRun: false,
  };

  // biome-ignore lint/style/useForOf: requires index mutation (args[++i]) for flag parsing
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-w" || arg === "--workspace") {
      options.workspaceId = args[++i] ?? "";
    } else if (arg === "-i" || arg === "--inject") {
      options.inject = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "-h" || arg === "--help") {
      console.log(`
Usage: reset-demo -w <workspaceId> [-i] [--dry-run]
...
`);
      process.exit(0);
    }
  }

  return options;
}

// After:
import { parseArgs as nodeParseArgs } from "node:util";

function parseArgs(): ResetOptions {
  const { values } = nodeParseArgs({
    args: process.argv.slice(2),
    options: {
      workspace: { type: "string", short: "w" },
      inject: { type: "boolean", short: "i", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
  });

  if (values.help) {
    console.log(`
Usage: reset-demo -w <workspaceId> [-i] [--dry-run]

Options:
  -w, --workspace  Workspace ID to reset (required)
  -i, --inject     Inject sandbox-1 dataset after cleanup
  --dry-run        Show what would be deleted without executing
  -h, --help       Show this help message

Example:
  pnpm --filter @repo/console-test-data reset-demo -- -w ws_abc123 -i
`);
    process.exit(0);
  }

  return {
    workspaceId: values.workspace ?? "",
    inject: values.inject ?? false,
    dryRun: values["dry-run"] ?? false,
  };
}
```

Note: Use `strict: false` to ignore unrecognized arguments (same as current behavior which silently skips unknown args).

---

#### 2d-b. `packages/console-test-data/src/cli/seed-integrations.ts`

**File**: `packages/console-test-data/src/cli/seed-integrations.ts`
**Lines**: 163-194

**Change**: Replace the manual `parseArgs()` function with `node:util parseArgs`.

```typescript
// Before (lines 163-194):
function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);
  const options: SeedOptions = { workspaceId: "", userId: "" };

  // biome-ignore lint/style/useForOf: requires index mutation (args[++i]) for flag parsing
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-w" || arg === "--workspace") {
      options.workspaceId = args[++i] ?? "";
    } else if (arg === "-u" || arg === "--user") {
      options.userId = args[++i] ?? "";
    } else if (arg === "-h" || arg === "--help") {
      console.log(`
Usage: seed-integrations -w <workspaceId> -u <clerkUserId>
...
`);
      process.exit(0);
    }
  }

  return options;
}

// After:
import { parseArgs as nodeParseArgs } from "node:util";

function parseArgs(): SeedOptions {
  const { values } = nodeParseArgs({
    args: process.argv.slice(2),
    options: {
      workspace: { type: "string", short: "w" },
      user: { type: "string", short: "u" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
  });

  if (values.help) {
    console.log(`
Usage: seed-integrations -w <workspaceId> -u <clerkUserId>

Seeds demo workspace integrations for GitHub, Vercel, Sentry,
and Linear. Idempotent — existing records are skipped.

Options:
  -w, --workspace  Workspace ID (required)
  -u, --user       Clerk user ID (required)
  -h, --help       Show this help message

Example:
  pnpm seed-integrations:prod -- -w ws_abc123 -u user_abc123
`);
    process.exit(0);
  }

  return {
    workspaceId: values.workspace ?? "",
    userId: values.user ?? "",
  };
}
```

---

### Success Criteria:

#### Automated Verification:
- [x] Linting passes: `pnpm check`
- [x] Type checking passes: `pnpm typecheck` (116/116 tasks passed)
- [ ] CLI help output works: `pnpm --filter @repo/console-test-data reset-demo -- --help`
- [ ] CLI help output works: `pnpm --filter @repo/console-test-data seed-integrations -- --help`

#### Manual Verification:
- [ ] `reset-demo` correctly parses `-w ws_abc123 -i --dry-run`
- [ ] `seed-integrations` correctly parses `-w ws_abc123 -u user_abc123`
- [ ] Unknown flags are silently ignored (same as current behavior)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Optional Accessibility Fixes (Biome-Excluded Files)

### Overview

These files are in `packages/ui/src/components/ui/`, which is excluded from Biome linting via `biome.jsonc:8`. These fixes improve accessibility and code quality but have zero impact on `pnpm check`.

### Changes Required:

#### 1b. `packages/ui/src/components/ui/breadcrumb.tsx` — BreadcrumbPage a11y fix

**File**: `packages/ui/src/components/ui/breadcrumb.tsx`
**Lines**: 52-63

**Change**: Remove `role="link"` and `aria-disabled="true"` from the BreadcrumbPage span. These create a phantom link that screen readers announce but users can never activate (WCAG 4.1.2 violation). The current page in a breadcrumb should not be announced as a link.

```tsx
// Before (lines 52-63):
function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("text-foreground font-normal", className)}
      {...props}
    />
  )
}

// After:
function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn("text-foreground font-normal", className)}
      {...props}
    />
  )
}
```

**Reference**: WAI-ARIA APG breadcrumb pattern, shadcn/ui issue #7639 and PR #7804.

---

#### 1c. `packages/ui/src/components/ui/input-otp.tsx` — InputOTPSeparator a11y fix

**File**: `packages/ui/src/components/ui/input-otp.tsx`
**Lines**: 94-100

**Change**: Replace `role="separator"` with `aria-hidden="true"`. The OTP separator is purely decorative (a minus icon between input groups). `role="separator"` implies an interactive splitter widget when focusable. `aria-hidden="true"` removes it from the accessibility tree entirely, which is correct for a decorative element. This is consistent with `BreadcrumbSeparator` and `BreadcrumbEllipsis` which both use `aria-hidden="true"`.

```tsx
// Before (lines 94-100):
function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon />
    </div>
  )
}

// After:
function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div aria-hidden="true" data-slot="input-otp-separator" {...props}>
      <MinusIcon />
    </div>
  )
}
```

---

### Success Criteria:

#### Automated Verification:
- [x] Linting passes: `pnpm check`
- [x] Type checking passes: `pnpm typecheck` (116/116 tasks passed)

#### Manual Verification:
- [ ] Breadcrumb component renders correctly (no visual change expected)
- [ ] OTP input separator renders correctly (no visual change expected)
- [ ] Screen reader announces breadcrumb current page without "link" role
- [ ] Screen reader skips OTP separator (aria-hidden)

---

## Testing Strategy

### Automated Tests:
- `pnpm check` — Biome lint passes with all suppressions removed
- `pnpm typecheck` — TypeScript compilation succeeds (especially satori.d.ts augmentation)
- No new test files needed — these are structural/attribute changes with no behavior change

### Manual Testing Steps:
1. Console app: Open workspace search, press Cmd+Enter to verify keyboard shortcut still works
2. Inline citations: Verify favicon images render; inspect fallback by blocking Google favicons
3. OG images: Verify `tw` prop still works in OG image generation (check any OG preview)
4. CLI scripts: Run `reset-demo --help` and `seed-integrations --help` to verify help output

## Performance Considerations

- No performance impact. All changes are structural (HTML element types, TypeScript declarations, arg parsing library).
- The `globalThis[name]` change eliminates `eval()` which is marginally faster than `eval` in V8.
- The `parseArgs` change has negligible performance difference for CLI startup.

## Migration Notes

- No data migration needed
- No breaking API changes
- No dependency additions (node:util is built-in)

## References

- Research: `thoughts/shared/research/2026-03-09-biome-ignore-audit-group1-suppressions.md`
- Biome Group 1 enablement commit: `899a1c9eb`
- HTML5 `<search>` element: Baseline 2023, all modern browsers
- WAI-ARIA APG breadcrumb pattern: shadcn/ui issue #7639
- `node:util parseArgs`: Built-in since Node.js 18.3+
