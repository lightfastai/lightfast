# useToast to Sonner Migration — Implementation Plan

## Overview

Migrate all legacy `useToast` (Radix-based) toast calls in `apps/console` to Sonner, standardize all Sonner imports to use the `@repo/ui` wrapper, remove the unused legacy `<Toaster />` from `apps/www`, and delete the legacy toast system from `@repo/ui`.

**Why**: The legacy `useToast` toasts in console are **silently lost** — the Radix `<Toaster>` component is not mounted in the console layout. Only the Sonner `<Toaster />` is rendered (`apps/console/src/app/layout.tsx:76`). This migration fixes broken toasts and eliminates dead code.

## Current State Analysis

### Dual Toast System
- **Sonner** (active): `<Toaster />` mounted in console root layout, used by 7 files
- **Legacy useToast** (broken): No renderer in console; 6 files fire toasts into the void

### Key Discoveries
- `apps/www` mounts legacy `<Toaster />` (`layout.tsx:157`) but **no file in www calls `useToast` or `toast()`** — it's dead code
- `apps/chat` also uses the legacy system (2 files + layout) — **excluded from this plan**, to be migrated separately
- 6 console files import `toast` directly from `"sonner"` instead of the `@repo/ui` wrapper
- The `@repo/ui` sonner wrapper (`packages/ui/src/components/ui/sonner.tsx`) re-exports `toast` from `sonner` unchanged

### API Mapping

| Legacy Pattern | Sonner Equivalent |
|---|---|
| `toast({ title: "...", description: "..." })` | `toast.success("...", { description: "..." })` |
| `toast({ title: "...", description: "...", variant: "destructive" })` | `toast.error("...", { description: "..." })` |

## Desired End State

After this plan is complete:
- All 12 console files use `import { toast } from "@repo/ui/components/ui/sonner"`
- All toast calls use `toast.success()` / `toast.error()` Sonner API
- `apps/www` has no toast system mounted (it doesn't use one)
- Legacy toast files removed from `@repo/ui` (with `apps/chat` as the **only remaining consumer** — noted for future cleanup)
- `@radix-ui/react-toast` **NOT removed** from `@repo/ui` dependencies (chat still depends on it)

### Verification
- `pnpm build:console` passes
- `pnpm lint` passes
- `pnpm typecheck` passes
- All toast notifications in console render visually via Sonner

## What We're NOT Doing

- Migrating `apps/chat` (deferred to separate plan)
- Removing `@radix-ui/react-toast` from `packages/ui` (chat still depends on legacy toast files)
- Deleting legacy toast files from `@repo/ui` (chat still imports from them)
- Adding Sonner to `apps/www` (it doesn't use toasts)
- Changing toast copy/messaging — preserving exact titles and descriptions
- Adding new toast functionality or changing toast behavior

---

## Phase 1: Migrate 6 Console Files from useToast to Sonner

### Overview
Replace all `useToast` imports and calls with Sonner's `toast` API in the 6 affected console files.

### Changes Required

#### 1. `apps/console/src/components/setup-guide-modal.tsx`

**Remove** (line 13):
```typescript
import { useToast } from "@repo/ui/hooks/use-toast";
```

**Add**:
```typescript
import { toast } from "@repo/ui/components/ui/sonner";
```

**Remove** (line 50):
```typescript
const { toast } = useToast();
```

**Replace toast calls**:

Lines 56-59 (success):
```typescript
// Before
toast({ title: "Copied to clipboard", description: "lightfast.yml template has been copied." });
// After
toast.success("Copied to clipboard", { description: "lightfast.yml template has been copied." });
```

Lines 62-66 (error):
```typescript
// Before
toast({ title: "Copy failed", description: "Failed to copy to clipboard. Please copy manually.", variant: "destructive" });
// After
toast.error("Copy failed", { description: "Failed to copy to clipboard. Please copy manually." });
```

---

#### 2. `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx`

**Remove** (line 13):
```typescript
import { useToast } from "@repo/ui/hooks/use-toast";
```

**Add**:
```typescript
import { toast } from "@repo/ui/components/ui/sonner";
```

**Remove** (line 30):
```typescript
const { toast } = useToast();
```

**Replace toast calls** (6 total):

Lines 129-133 (error):
```typescript
toast.error("Repositories not linked", { description: "Workspace created, but failed to connect repositories. You can add them later." });
```

Lines 142-146 (error):
```typescript
toast.error("Validation failed", { description: "Please fix the errors in the form before submitting." });
```

Lines 151-155 (error):
```typescript
toast.error("Organization required", { description: "Please select an organization." });
```

Lines 160-164 (error):
```typescript
toast.error("Workspace name required", { description: "Please enter a workspace name." });
```

Lines 196-201 (success — preserving dynamic description):
```typescript
toast.success("Workspace created!", {
  description: repoCount > 0
    ? `${workspaceName} has been created with ${repoCount} repositor${repoCount === 1 ? "y" : "ies"}.`
    : `${workspaceName} workspace is ready. Add sources to get started.`,
});
```

Lines 209-213 (error):
```typescript
toast.error("Creation failed", {
  description: error instanceof Error ? error.message : "Failed to create workspace. Please try again.",
});
```

---

#### 3. `apps/console/src/components/repository-config-dialog.tsx`

**Remove** (line 13):
```typescript
import { useToast } from "@repo/ui/hooks/use-toast";
```

**Add**:
```typescript
import { toast } from "@repo/ui/components/ui/sonner";
```

**Remove** (line 30):
```typescript
const { toast } = useToast();
```

**Replace toast call** (line 48):
```typescript
// Before
toast({ title: "Failed to load config", description: message, variant: "destructive" });
// After
toast.error("Failed to load config", { description: message });
```

---

#### 4. `apps/console/src/components/github-connect-dialog.tsx`

**Remove** (line 14):
```typescript
import { useToast } from "@repo/ui/hooks/use-toast";
```

**Add**:
```typescript
import { toast } from "@repo/ui/components/ui/sonner";
```

**Remove** (line 36):
```typescript
const { toast } = useToast();
```

**Replace toast calls**:

Lines 53-56 (success):
```typescript
toast.success("GitHub connected", { description: "Successfully connected to GitHub. You can now set up environments." });
```

Lines 64-68 (error):
```typescript
toast.error("GitHub authorization failed", { description: `Error: ${githubError}` });
```

---

#### 5. `apps/console/src/app/(app)/(org)/[slug]/settings/_components/team-general-settings-client.tsx`

**Remove** (line 21):
```typescript
import { useToast } from "@repo/ui/hooks/use-toast";
```

**Add**:
```typescript
import { toast } from "@repo/ui/components/ui/sonner";
```

**Remove** (line 37):
```typescript
const { toast } = useToast();
```

**Replace toast calls**:

Lines 71-75 (error):
```typescript
toast.error("Failed to update team name", { description: err.message || "Please try again." });
```

Lines 79-82 (success):
```typescript
toast.success("Team updated!", { description: `Team name changed to "${data.name}"` });
```

Lines 118-122 (error):
```typescript
toast.error("Validation failed", { description: "Please fix the errors in the form before submitting." });
```

---

#### 6. `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/settings/_components/workspace-general-settings-client.tsx`

**Remove** (line 21):
```typescript
import { useToast } from "@repo/ui/hooks/use-toast";
```

**Add**:
```typescript
import { toast } from "@repo/ui/components/ui/sonner";
```

**Remove** (line 38):
```typescript
const { toast } = useToast();
```

**Replace toast calls**:

Lines 148-152 (error):
```typescript
toast.error("Failed to update workspace name", { description: err.message || "Please try again." });
```

Lines 156-159 (success):
```typescript
toast.success("Workspace updated!", { description: `Workspace name changed to "${data.newWorkspaceName}"` });
```

Lines 182-186 (error):
```typescript
toast.error("Validation failed", { description: "Please fix the errors in the form before submitting." });
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm build:console` succeeds
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] No remaining `useToast` imports in `apps/console/`: `grep -r "useToast" apps/console/src/` returns empty

#### Manual Verification:
- [ ] Setup guide modal: clipboard copy shows success/error toast
- [ ] Create workspace: validation errors and success show toasts
- [ ] Repository config dialog: load failure shows error toast
- [ ] GitHub connect dialog: OAuth success/failure shows toasts
- [ ] Team settings: name update success/failure shows toasts
- [ ] Workspace settings: name update success/failure shows toasts

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Standardize Existing Sonner Imports

### Overview
Update 6 console files that import `toast` directly from `"sonner"` to use `"@repo/ui/components/ui/sonner"` for consistency with the vendor abstraction pattern.

### Changes Required

Each file needs only the import line changed. No toast call changes needed.

| File | Line | Before | After |
|------|------|--------|-------|
| `apps/console/src/components/jobs-table.tsx` | 24 | `import { toast } from "sonner"` | `import { toast } from "@repo/ui/components/ui/sonner"` |
| `apps/console/src/components/integrations/vercel-project-selector.tsx` | 17 | `import { toast } from "sonner"` | `import { toast } from "@repo/ui/components/ui/sonner"` |
| `apps/console/src/app/(app)/(user)/account/settings/api-key/_components/api-key-list.tsx` | 23 | `import { toast } from "sonner"` | `import { toast } from "@repo/ui/components/ui/sonner"` |
| `apps/console/src/app/(app)/(user)/account/settings/sources/_components/sources-list.tsx` | 6 | `import { toast } from "sonner"` | `import { toast } from "@repo/ui/components/ui/sonner"` |
| `apps/console/src/app/(app)/(org)/[slug]/settings/api-keys/_components/org-api-key-list.tsx` | 23 | `import { toast } from "sonner"` | `import { toast } from "@repo/ui/components/ui/sonner"` |
| `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/connect-button.tsx` | 8 | `import { toast } from "sonner"` | `import { toast } from "@repo/ui/components/ui/sonner"` |

### Success Criteria

#### Automated Verification:
- [x] `pnpm build:console` succeeds
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] No remaining direct sonner imports: `grep -r 'from "sonner"' apps/console/src/` returns empty
- [x] All toast imports in console use `@repo/ui`: `grep -r 'from "@repo/ui/components/ui/sonner"' apps/console/src/` returns 14 files (6 migrated + 6 standardized + 1 create-team-button + 1 layout Toaster)

---

## Phase 3: Remove Unused Legacy Toaster from apps/www

### Overview
Remove the legacy `<Toaster />` from the www layout. No files in www use toast — the component is dead code.

### Changes Required

#### `apps/www/src/app/layout.tsx`

**Remove import** (line 6):
```typescript
import { Toaster } from "@repo/ui/components/ui/toaster";
```

**Remove component** (line 157):
```typescript
<Toaster />
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/www build` succeeds (or `pnpm build` for www)
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] No toast imports remain in `apps/www/`: `grep -r "toast\|Toaster" apps/www/src/` returns no `@repo/ui` toast imports

#### Manual Verification:
- [ ] www site renders normally with no console errors

---

## Phase 4: Clean Up Legacy Toast Files (Partial)

### Overview
Since `apps/chat` still uses the legacy toast system, we **cannot delete** the legacy files or remove `@radix-ui/react-toast`. Instead, this phase documents the remaining dependency and adds a TODO for future cleanup.

### What We CAN'T Remove Yet
- `packages/ui/src/hooks/use-toast.tsx` — imported by `apps/chat` (2 files)
- `packages/ui/src/components/ui/toaster.tsx` — imported by `apps/chat` (1 file)
- `packages/ui/src/components/ui/toast.tsx` — used by toaster.tsx
- `@radix-ui/react-toast` dependency in `packages/ui/package.json`

### Remaining Legacy Consumers (chat app)
| File | Import |
|------|--------|
| `apps/chat/src/components/cancellation-section.tsx:22` | `import { toast } from "@repo/ui/hooks/use-toast"` |
| `apps/chat/src/components/add-payment-method-form.tsx:9` | `import { toast } from "@repo/ui/hooks/use-toast"` |
| `apps/chat/src/app/(payment)/layout.tsx:5` | `import { Toaster } from "@repo/ui/components/ui/toaster"` |

### Success Criteria

#### Automated Verification:
- [x] No `useToast` or legacy `Toaster` imports remain in `apps/console/` or `apps/www/`
- [x] `pnpm build:console` succeeds
- [x] `pnpm typecheck` passes

---

## Testing Strategy

### Automated Tests
- Full type check: `pnpm typecheck`
- Full lint: `pnpm lint`
- Console build: `pnpm build:console`
- WWW build: verify www still builds

### Manual Testing Steps
1. **Console**: Navigate through each of the 6 migrated components and trigger toast conditions
2. **WWW**: Load the marketing site and confirm no errors in dev tools console
3. **Verify no regressions**: Check that the 7 already-migrated Sonner files still work correctly

## References

- Research document: `thoughts/shared/research/2026-02-06-usetoast-to-sonner-migration.md`
- Sonner wrapper: `packages/ui/src/components/ui/sonner.tsx`
- Console root layout (Sonner mount): `apps/console/src/app/layout.tsx:76`
- Legacy useToast hook: `packages/ui/src/hooks/use-toast.tsx`
