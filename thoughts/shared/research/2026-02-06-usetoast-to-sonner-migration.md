---
date: 2026-02-06T02:48:39+0000
researcher: claude
git_commit: 5eaa1050042cde2cbd11f812af558fc900123918
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "useToast to Sonner migration - apps/console audit"
tags: [research, codebase, toast, sonner, useToast, migration, apps-console]
status: complete
last_updated: 2026-02-06
last_updated_by: claude
---

# Research: useToast to Sonner Migration - apps/console Audit

**Date**: 2026-02-06T02:48:39+0000
**Researcher**: claude
**Git Commit**: 5eaa1050042cde2cbd11f812af558fc900123918
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

Deep research apps/console to find all `useToast` references and document what needs to change to move to Sonner.

## Summary

The console app has **two toast systems** running simultaneously:

1. **Sonner** (primary) — Already mounted in the root layout (`apps/console/src/app/layout.tsx:76`), used by ~6 files with `import { toast } from "sonner"`
2. **Legacy useToast** (Radix-based) — Used by **6 files** that import `useToast` from `@repo/ui/hooks/use-toast`

The legacy Toaster component (`@repo/ui/components/ui/toaster`) is **NOT** mounted in the console app layout, which means the 6 files calling `useToast` are firing toasts into a system with no renderer. The Sonner `<Toaster />` is the only toast renderer in the console app.

## Detailed Findings

### Files Using Legacy useToast (Must Migrate)

#### 1. `apps/console/src/components/setup-guide-modal.tsx`

**Import (line 13):** `import { useToast } from "@repo/ui/hooks/use-toast"`
**Hook call (line 50):** `const { toast } = useToast()`

| Location | Toast Call | Variant |
|----------|-----------|---------|
| Lines 56-59 | `toast({ title: "Copied to clipboard", description: "lightfast.yml template has been copied." })` | default |
| Lines 62-66 | `toast({ title: "Copy failed", description: "Failed to copy to clipboard. Please copy manually.", variant: "destructive" })` | destructive |

---

#### 2. `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx`

**Import (line 13):** `import { useToast } from "@repo/ui/hooks/use-toast"`
**Hook call (line 30):** `const { toast } = useToast()`

| Location | Toast Call | Variant |
|----------|-----------|---------|
| Lines 129-133 | `toast({ title: "Repositories not linked", description: "Workspace created, but failed to connect repositories..." , variant: "destructive" })` | destructive |
| Lines 142-146 | `toast({ title: "Validation failed", description: "Please fix the errors in the form before submitting.", variant: "destructive" })` | destructive |
| Lines 151-155 | `toast({ title: "Organization required", description: "Please select an organization.", variant: "destructive" })` | destructive |
| Lines 160-164 | `toast({ title: "Workspace name required", description: "Please enter a workspace name.", variant: "destructive" })` | destructive |
| Lines 196-201 | `toast({ title: "Workspace created!", description: dynamic message based on repo count })` | default |
| Lines 209-213 | `toast({ title: "Creation failed", description: error.message or fallback, variant: "destructive" })` | destructive |

---

#### 3. `apps/console/src/components/repository-config-dialog.tsx`

**Import (line 13):** `import { useToast } from "@repo/ui/hooks/use-toast"`
**Hook call (line 30):** `const { toast } = useToast()`

| Location | Toast Call | Variant |
|----------|-----------|---------|
| Line 48 | `toast({ title: "Failed to load config", description: message, variant: "destructive" })` | destructive |

---

#### 4. `apps/console/src/components/github-connect-dialog.tsx`

**Import (line 14):** `import { useToast } from "@repo/ui/hooks/use-toast"`
**Hook call (line 36):** `const { toast } = useToast()`

| Location | Toast Call | Variant |
|----------|-----------|---------|
| Lines 53-56 | `toast({ title: "GitHub connected", description: "Successfully connected to GitHub..." })` | default |
| Lines 64-68 | `toast({ title: "GitHub authorization failed", description: "Error: ${githubError}", variant: "destructive" })` | destructive |

---

#### 5. `apps/console/src/app/(app)/(org)/[slug]/settings/_components/team-general-settings-client.tsx`

**Import (line 21):** `import { useToast } from "@repo/ui/hooks/use-toast"`
**Hook call (line 37):** `const { toast } = useToast()`

| Location | Toast Call | Variant |
|----------|-----------|---------|
| Lines 71-75 | `toast({ title: "Failed to update team name", description: err.message or fallback, variant: "destructive" })` | destructive |
| Lines 79-82 | `toast({ title: "Team updated!", description: "Team name changed to ${data.name}" })` | default |
| Lines 118-122 | `toast({ title: "Validation failed", description: "Please fix the errors in the form before submitting.", variant: "destructive" })` | destructive |

---

#### 6. `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/settings/_components/workspace-general-settings-client.tsx`

**Import (line 21):** `import { useToast } from "@repo/ui/hooks/use-toast"`
**Hook call (line 38):** `const { toast } = useToast()`

| Location | Toast Call | Variant |
|----------|-----------|---------|
| Lines 148-152 | `toast({ title: "Failed to update workspace name", description: err.message or fallback, variant: "destructive" })` | destructive |
| Lines 156-159 | `toast({ title: "Workspace updated!", description: "Workspace name changed to ${data.newWorkspaceName}" })` | default |
| Lines 182-186 | `toast({ title: "Validation failed", description: "Please fix the errors in the form before submitting.", variant: "destructive" })` | destructive |

### Existing Sonner Usage in Console (Already Migrated)

These files already use Sonner and require no changes:

| File | Import |
|------|--------|
| `apps/console/src/components/integrations/vercel-project-selector.tsx:17` | `import { toast } from "sonner"` |
| `apps/console/src/components/jobs-table.tsx:24` | `import { toast } from "sonner"` |
| `apps/console/src/app/(app)/(user)/account/settings/sources/_components/sources-list.tsx:6` | `import { toast } from "sonner"` |
| `apps/console/src/app/(app)/(user)/account/settings/api-key/_components/api-key-list.tsx:23` | `import { toast } from "sonner"` |
| `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/connect-button.tsx:8` | `import { toast } from "sonner"` |
| `apps/console/src/app/(app)/(org)/[slug]/settings/api-keys/_components/org-api-key-list.tsx:23` | `import { toast } from "sonner"` |
| `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:9` | `import { toast } from "@repo/ui/components/ui/sonner"` |

### Sonner Infrastructure (Already In Place)

- **Sonner Wrapper**: `packages/ui/src/components/ui/sonner.tsx` — Theme-aware wrapper with CSS variable mapping
- **Root Layout Mount**: `apps/console/src/app/layout.tsx:76` — `<Toaster />` from Sonner
- **Package dep**: `sonner@^2.0.6` in both `packages/ui` and `apps/console`

### Legacy Toast Infrastructure (To Remove After Migration)

- **useToast Hook**: `packages/ui/src/hooks/use-toast.tsx` — Custom reducer-based toast state management (190 lines)
- **Legacy Toaster**: `packages/ui/src/components/ui/toaster.tsx` — Radix UI toast renderer (36 lines)
- **Radix Toast Primitives**: `packages/ui/src/components/ui/toast.tsx` — Styled Radix components

**Note**: The legacy Toaster is still used by `apps/www` (`apps/www/src/app/layout.tsx`), so these files cannot be deleted until www is also migrated.

### API Mapping: useToast → Sonner

The legacy `useToast` API uses an object pattern while Sonner uses method chaining:

| Legacy Pattern | Sonner Equivalent |
|----------------|-------------------|
| `toast({ title: "...", description: "..." })` | `toast.success("...", { description: "..." })` |
| `toast({ title: "...", description: "...", variant: "destructive" })` | `toast.error("...", { description: "..." })` |

- Legacy `title` → Sonner first argument (message string)
- Legacy `description` → Sonner `{ description: "..." }` option
- Legacy `variant: "destructive"` → Sonner `toast.error()` method
- Legacy default variant → Sonner `toast.success()` or `toast()` method

## Code References

- `packages/ui/src/hooks/use-toast.tsx` — Legacy useToast hook definition
- `packages/ui/src/components/ui/toaster.tsx` — Legacy Toaster component
- `packages/ui/src/components/ui/sonner.tsx` — Sonner wrapper and re-export
- `packages/ui/src/components/ui/toast.tsx` — Radix toast primitives
- `apps/console/src/app/layout.tsx:6,76` — Sonner Toaster mount
- `apps/www/src/app/layout.tsx:6,157` — Legacy Toaster mount (www still uses it)

## Architecture Documentation

The toast system in the monorepo currently has a dual implementation:
- **Sonner** is the active system with a `<Toaster />` rendered in the console root layout
- **useToast** (Radix-based) has no renderer in console, meaning its toasts are silently lost
- Both systems coexist in the `@repo/ui` package exports
- The `apps/www` marketing site still depends on the legacy system

## Open Questions

1. Should the 6 files using direct `import { toast } from "sonner"` be standardized to use `import { toast } from "@repo/ui/components/ui/sonner"` for consistency?
2. Should `apps/www` be migrated to Sonner at the same time, enabling full removal of the legacy toast system?
3. Should the `@repo/ui` package continue exporting the legacy toast components for backwards compatibility?
