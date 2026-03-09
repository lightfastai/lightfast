# Extract SeparatorWithText to Shared Component

## Overview

Extract the duplicated `SeparatorWithText` function component from `sign-in/page.tsx` and `sign-up/page.tsx` into a single shared component file in `_components/`, then replace both inline definitions with imports.

## Current State Analysis

Both pages define an identical local `SeparatorWithText` component:

- `apps/auth/src/app/(app)/(auth)/sign-in/page.tsx:86-97`
- `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx:142-153`

Both import `Separator` from `@repo/ui/components/ui/separator` to support this component.

The `_components/` directory already contains shared auth components (`email-form.tsx`, `oauth-button.tsx`, `error-banner.tsx`, etc.), making it the natural home for extraction.

## Desired End State

- A single `separator-with-text.tsx` file in `_components/` exports `SeparatorWithText`
- Both pages import it from the shared location
- The `Separator` import is removed from `sign-up/page.tsx` (no longer needed there)
- The `Separator` import is removed from `sign-in/page.tsx` (no longer needed there)
- JSX structure, classNames, and the `text` prop are preserved exactly

## What We're NOT Doing

- Changing the component's API, styling, or behavior
- Moving it to `@repo/ui` — it's auth-specific
- Adding tests for a trivial presentational component

## Implementation — Single Phase

### Changes Required:

#### 1. Create shared component
**File**: `apps/auth/src/app/(app)/(auth)/_components/separator-with-text.tsx` (new)

```tsx
import { Separator } from "@repo/ui/components/ui/separator";

export function SeparatorWithText({ text }: { text: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <Separator className="w-full" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}
```

#### 2. Update sign-in page
**File**: `apps/auth/src/app/(app)/(auth)/sign-in/page.tsx`

- Remove `import { Separator } from "@repo/ui/components/ui/separator";` (line 1)
- Add `import { SeparatorWithText } from "../_components/separator-with-text";`
- Remove the local `SeparatorWithText` function definition (lines 86-97)

#### 3. Update sign-up page
**File**: `apps/auth/src/app/(app)/(auth)/sign-up/page.tsx`

- Remove `import { Separator } from "@repo/ui/components/ui/separator";` (line 2)
- Add `import { SeparatorWithText } from "../_components/separator-with-text";`
- Remove the local `SeparatorWithText` function definition (lines 142-153)

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [ ] Linting passes: `pnpm --filter @lightfast/auth lint`
- [ ] Auth app builds successfully: `pnpm build:auth`

#### Manual Verification:
- [ ] Sign-in page renders the "Or" separator between email form and OAuth button
- [ ] Sign-up page renders the "Or" separator between legal text and OAuth button
