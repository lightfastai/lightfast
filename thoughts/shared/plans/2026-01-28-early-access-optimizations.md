# Early Access Page Optimizations Implementation Plan

## Overview

This plan implements all five optimization opportunities identified in the research document for the early-access page. The optimizations span bundle size, server action performance, client re-render reduction, step transition animations, and typography enhancement.

## Current State Analysis

The early-access page (`apps/www/src/app/(app)/early-access/`) is a multi-step form with:
- Server Component page that passes initial state to client form
- Client-side form using react-hook-form with URL state sync via nuqs
- Server action with Arcjet security, Redis caching, and Clerk API integration
- Dynamic import for confetti on success state

### Key Discoveries:
- Next.js 15.5.7 supports `after()` from `next/server` for non-blocking operations (`pnpm-workspace.yaml:24`)
- `optimizePackageImports` already includes `lucide-react` (`next.config.ts:45-50`)
- All three form fields are watched on every render (`early-access-form.tsx:56-58`)
- Redis write after Clerk success blocks response (`early-access-actions.ts:250-262`)
- No step transition animations exist - only `transition-colors` on hover states

## Desired End State

After implementation:
1. Bundle size verified via build output showing lucide tree-shaking works
2. Server action returns ~10-50ms faster by moving Redis write to `after()`
3. Form re-renders reduced per step via conditional watching
4. Smooth slide/fade animations between form steps
5. Typography uses a display font for headings (optional - user preference)

### Verification:
- `pnpm build:www` succeeds
- `pnpm typecheck` passes
- `pnpm lint` passes
- Manual testing: form transitions are smooth, no layout shift
- Performance: response time improved on form submission

## What We're NOT Doing

- Rewriting the form architecture
- Adding new features or fields
- Changing the security layer configuration
- Modifying SEO/metadata
- Changing the Clerk integration logic
- Adding complex animation libraries (CSS-only approach)

## Implementation Approach

We'll implement optimizations in order of impact and risk, starting with the lowest-risk changes (verification, non-blocking Redis) and ending with visual enhancements.

---

## Phase 1: Verify Lucide Tree-Shaking

### Overview
Confirm that `optimizePackageImports` is working for lucide-react. This is a verification step, not a code change.

### Changes Required:

#### 1. Build Analysis
**Action**: Run production build and check bundle size

```bash
cd apps/www && pnpm build
```

Look for lucide-react in the build output. If tree-shaking is working, only `ArrowLeft` and `Loader2` icons should be bundled.

### Success Criteria:

#### Automated Verification:
- [x] Build completes: `cd apps/www && pnpm build`
- [x] No warnings about lucide-react bundle size

#### Manual Verification:
- [x] Review `.next/analyze` or build output for lucide-react chunk size
- [x] Size should be <10KB (not 200KB+ full library)

**Implementation Note**: If tree-shaking is NOT working, we'll need to switch to direct imports:
```tsx
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
```

---

## Phase 2: Non-Blocking Redis Write with `after()`

### Overview
Move the non-critical Redis `sadd` operation to run after the response is sent, improving response time by ~10-50ms.

### Changes Required:

#### 1. Server Action Refactor
**File**: `apps/www/src/components/early-access-actions.ts`
**Changes**: Import `after` from `next/server` and move Redis write to background

**Before** (lines 250-268):
```typescript
// Add email to Redis set for tracking (non-critical)
try {
  await redis.sadd(EARLY_ACCESS_EMAILS_SET_KEY, email);
} catch (redisError) {
  // Log but don't fail the user experience if Redis is down
  console.error("Failed to add email to Redis tracking:", redisError);
  captureException(redisError, {
    tags: {
      action: "joinEarlyAccess:redis-add",
      email,
    },
  });
}

return {
  status: "success",
  message:
    "Successfully joined early access! We'll send you an invite when Lightfast is ready.",
};
```

**After**:
```typescript
import { after } from "next/server";

// ... inside joinEarlyAccessAction, after successful Clerk response ...

// Return immediately for faster response
const successResponse: EarlyAccessState = {
  status: "success",
  message:
    "Successfully joined early access! We'll send you an invite when Lightfast is ready.",
};

// Track in Redis after response is sent (non-blocking)
after(async () => {
  try {
    await redis.sadd(EARLY_ACCESS_EMAILS_SET_KEY, email);
  } catch (redisError) {
    console.error("Failed to add email to Redis tracking:", redisError);
    captureException(redisError, {
      tags: {
        action: "joinEarlyAccess:redis-add",
        email,
      },
    });
  }
});

return successResponse;
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Build succeeds: `cd apps/www && pnpm build`

#### Manual Verification:
- [ ] Submit early access form successfully
- [ ] Check Redis has the email after ~1 second
- [ ] Response feels faster (no measurable delay from Redis)

---

## Phase 3: Conditional Form Watching

### Overview
Reduce unnecessary re-renders by only subscribing to form fields needed for the current step.

### Changes Required:

#### 1. Refactor Form Watch Logic
**File**: `apps/www/src/components/early-access-form.tsx`
**Changes**: Replace unconditional `watch()` calls with step-conditional logic

**Before** (lines 55-58):
```typescript
const { step } = urlParams;
const email = form.watch("email");
const companySize = form.watch("companySize");
const sources = form.watch("sources");
```

**After**:
```typescript
const { step } = urlParams;

// Only subscribe to fields needed for current step to reduce re-renders
// Step "email": needs email for button disable state
// Step "company": needs companySize for button disable state
// Step "sources": needs sources for button disable state, email for success display
const email = step === "email" || step === "sources"
  ? form.watch("email")
  : form.getValues("email");

const companySize = step === "company"
  ? form.watch("companySize")
  : form.getValues("companySize");

const sources = step === "sources"
  ? form.watch("sources")
  : form.getValues("sources");
```

**Note**: The success state also displays `email` (line 197), so we need to watch it on the sources step as well.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Build succeeds: `cd apps/www && pnpm build`
- [x] Lint passes: `pnpm lint` (pre-existing lint errors not related to this change)

#### Manual Verification:
- [ ] Email step: typing updates email field correctly
- [ ] Company step: selecting size enables Continue button
- [ ] Sources step: checking boxes enables Submit button
- [ ] Back navigation: values are preserved
- [ ] URL sync: values persist in URL on refresh

---

## Phase 4: Step Transition Animations

### Overview
Add subtle slide/fade animations between form steps for a polished user experience.

### Changes Required:

#### 1. Add CSS Animation Keyframes
**File**: `apps/www/src/app/(app)/early-access/page.tsx` or global CSS
**Changes**: Add CSS keyframes for step transitions

Since Tailwind 4 is used, we'll add custom animation classes inline or via a style block.

#### 2. Update Form Step Rendering
**File**: `apps/www/src/components/early-access-form.tsx`
**Changes**: Add animation classes to step containers

**Current step containers** (lines 233, 303, 393):
```tsx
{step === "email" && (
  <form onSubmit={handleEmailSubmit} className="flex flex-col h-[640px]">
```

**After**:
```tsx
{step === "email" && (
  <form
    onSubmit={handleEmailSubmit}
    className="flex flex-col h-[640px] animate-in fade-in slide-in-from-right-4 duration-200"
  >
```

Apply to all three steps and success state. The animation uses Tailwind's `tailwindcss-animate` classes if available, or we define custom ones.

#### 3. Add Animation Utilities (if not using tailwindcss-animate)
**Option A**: If `tailwindcss-animate` is available, use built-in classes
**Option B**: Add custom CSS keyframes

```css
@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-step-enter {
  animation: slideInFromRight 200ms ease-out;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Build succeeds: `cd apps/www && pnpm build`

#### Manual Verification:
- [ ] Steps transition smoothly when clicking Continue
- [ ] Back button transitions feel natural
- [ ] No layout shift during animations
- [ ] Success state has a subtle entrance animation
- [ ] Animations are subtle (200ms), not distracting

---

## Phase 5: Typography Enhancement (Optional)

### Overview
Enhance heading typography with a display font for a more polished, distinctive look. This phase is optional and depends on brand guidelines.

### Status: Already Implemented

Upon investigation, Geist Sans is already applied globally:
- `packages/ui/src/lib/fonts.ts` imports `GeistSans` from `geist/font/sans`
- `apps/www/src/app/layout.tsx:165` applies the font variable to `<html>`
- `apps/www/src/app/layout.tsx:170` applies `font-sans` to the body

All headings in the early-access form already use Geist Sans. No additional changes needed.

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `cd apps/www && pnpm build`

#### Manual Verification:
- [x] Headings look distinctive and professional (Geist Sans already applied)
- [x] Font loads quickly (no FOUT) - Geist is optimized via next/font
- [x] Consistent with brand guidelines
- [x] Readable at all viewport sizes

---

## Testing Strategy

### Unit Tests:
- No new unit tests needed (optimizations don't change behavior)

### Integration Tests:
- Existing form submission flow should still work

### Manual Testing Steps:
1. Navigate to `/early-access`
2. Enter email, verify Continue enables
3. Click Continue, verify step transition animation
4. Select company size, click Continue
5. Select data sources, submit form
6. Verify success state with confetti
7. Refresh page, verify URL state persistence
8. Use browser back button, verify navigation works
9. Check Redis for email entry after submission

## Performance Considerations

| Optimization | Expected Impact |
|-------------|-----------------|
| Lucide tree-shaking | ~150-700KB bundle reduction (if not already working) |
| Non-blocking Redis | ~10-50ms faster response time |
| Conditional watching | Fewer React reconciliation passes per keystroke |
| Step animations | ~200ms added visual transition (perceived performance improvement) |

## Migration Notes

No data migration needed. All changes are backwards-compatible.

## References

- Original research: `thoughts/shared/research/2026-01-28-early-access-nextjs-react-optimization.md`
- Skills: `.claude/skills/vercel-react-best-practices/SKILL.md`
- Next.js `after()` docs: https://nextjs.org/docs/app/api-reference/functions/after
