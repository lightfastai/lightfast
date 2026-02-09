# Enable React Compiler for apps/console

## Overview

Enable React Compiler in full compilation mode for `apps/console` to provide automatic memoization across all 88 client components, eliminating the need for manual `useMemo`, `useCallback`, and `React.memo`. This includes adding the ESLint plugin for compile-time violation detection and cleaning up now-redundant manual memoization.

## Current State Analysis

**File**: `apps/console/next.config.ts:1-129`

The console application uses Next.js 15.5.x with React 19.2.1. No React Compiler configuration exists anywhere in the Lightfast codebase. The app currently relies on:
- 11 `useMemo` instances (expensive computations, reference stability)
- 8 `useCallback` instances (event handlers, search functions)
- 2 `React.memo` instances (message list sub-components)
- Default SWC compiler for all JSX transformation

**Compatibility assessment (from codebase analysis)**:
- 88 client components, all functional (no legacy class components except 3 error boundaries, auto-skipped)
- No `useLayoutEffect` or `useInsertionEffect`
- 5 ref mutation instances - all standard escape hatch patterns (AbortController, timers, previous values)
- External state: Zustand (1 store), react-hook-form (2 providers), nuqs URL state, TanStack Query - all compatible
- No dynamic imports (`next/dynamic` or `React.lazy`)

### Key Discoveries:
- Vendor config already has `compiler.removeConsole` at `vendor/next/src/next-config-builder.ts:14-19` - the `mergeNextConfig` deep merge utility will safely compose our new `experimental.reactCompiler` alongside existing config
- React Compiler is experimental in Next.js 15 (config goes under `experimental`), stable in Next.js 16 (top-level `reactCompiler`)
- The heaviest components that will benefit most: `workspace-search.tsx` (6 useCallback), `answer-messages.tsx` (2 memo + useMemo), `answer-interface.tsx` (3 useCallback), `jobs-table.tsx` (polling + mutations)
- Known risk: `react-hook-form` has reported issues with `useWatch`/`getValues` under React Compiler - need to verify workspace creation and settings forms work correctly
- Build time will increase due to Babel dependency - no strict limit enforced, but we'll measure the delta

## Desired End State

After completing this plan:

1. React Compiler enabled in full mode for all client components in `apps/console`
2. `eslint-plugin-react-compiler` active with `error` severity
3. All 88 client components compile without violations
4. Manual memoization (`useMemo`, `useCallback`, `React.memo`) removed where the compiler handles it
5. No functional regressions on any route
6. Build time delta measured and documented

**Verification**: `pnpm build:console` succeeds with React Compiler enabled. ESLint passes with compiler plugin. All critical routes function correctly (workspace dashboard, search, AI chat, jobs, settings, connector management).

## What We're NOT Doing

1. **Enabling for other apps** - Scoped to `apps/console` only. Other apps (www, auth, chat, docs) are separate initiatives.
2. **Upgrading to Next.js 16** - Using `experimental.reactCompiler` on current Next.js 15.5.x.
3. **Adding `react-compiler-runtime`** - Only needed for React 17/18; console uses React 19.2.1.
4. **Changing component architecture** - Only removing redundant memoization wrappers, not restructuring components.
5. **Adding Turbopack resolve aliases** - Not needed for React 19 (no runtime shim required).

## Implementation Approach

Four incremental phases, each independently testable. Phase 1 enables the compiler. Phase 2 verifies the build and tests all critical paths. Phase 3 fixes any violations found. Phase 4 cleans up redundant manual memoization.

---

## Phase 1: Install Dependencies & Configure

### Overview
Install `babel-plugin-react-compiler` and `eslint-plugin-react-compiler`, then configure React Compiler in `next.config.ts` and ESLint.

### Changes Required:

#### 1. Install dependencies
```bash
cd apps/console
pnpm add -D babel-plugin-react-compiler eslint-plugin-react-compiler
```

#### 2. Enable React Compiler in Next.js config
**File**: `apps/console/next.config.ts`
**Location**: Add `reactCompiler` inside the `experimental` block (after line 52)

**Before** (lines 51-93):
```typescript
experimental: {
  optimizeCss: true,
  optimizePackageImports: [
    // ... existing packages
  ],
  turbopackScopeHoisting: false,
  serverActions: { /* ... */ },
  staleTimes: { /* ... */ },
},
```

**After**:
```typescript
experimental: {
  reactCompiler: true,
  optimizeCss: true,
  optimizePackageImports: [
    // ... existing packages
  ],
  turbopackScopeHoisting: false,
  serverActions: { /* ... */ },
  staleTimes: { /* ... */ },
},
```

#### 3. Add ESLint plugin
**File**: `apps/console/eslint.config.js`

Add the React Compiler ESLint plugin to the existing config array:

```javascript
import reactCompiler from "eslint-plugin-react-compiler";

// Add to the exported config array:
{
  plugins: {
    "react-compiler": reactCompiler,
  },
  rules: {
    "react-compiler/react-compiler": "error",
  },
},
```

### Success Criteria:

#### Automated Verification:
- [x] Dependencies installed: `pnpm --filter @lightfast/console list babel-plugin-react-compiler eslint-plugin-react-compiler`
- [x] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [x] Build completes: `pnpm build:console`
- [x] ESLint runs without config errors: `pnpm --filter @lightfast/console lint`

#### Manual Verification:
- [ ] Confirm build output shows React Compiler is active (look for Babel compilation messages in build logs)
- [ ] Dev server starts: `pnpm dev:console` - verify no startup errors

**Implementation Note**: After completing this phase and all automated verification passes, record the build time for comparison. Then proceed to Phase 2 for thorough testing.

---

## Phase 2: Build Verification & Compatibility Testing

### Overview
Verify the build succeeds, measure build time impact, and test all critical user flows to ensure React Compiler doesn't introduce regressions.

### Changes Required:

#### 1. Record baseline build time (before Phase 1 changes)
```bash
# If you haven't already, record baseline from before Phase 1
time pnpm build:console
```

#### 2. Record React Compiler build time
```bash
time pnpm build:console
```

#### 3. Run bundle analysis (optional but recommended)
```bash
ANALYZE=true pnpm build:console
```
Compare First Load JS sizes in build output. React Compiler should not significantly change bundle sizes (it's a compile-time optimization, not a bundle-size one).

### Success Criteria:

#### Automated Verification:
- [x] Build completes without errors: `pnpm build:console`
- [x] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [x] ESLint passes: `pnpm --filter @lightfast/console lint`
- [x] Build time delta recorded: 1m 8.763s with React Compiler (no baseline available)

#### Manual Verification:
Test each critical flow on the dev server (`pnpm dev:console`):

- [ ] **Authentication flow**: Sign in → land on workspace dashboard
- [ ] **Workspace dashboard** (`/[slug]/[workspaceName]`): All 8 data panels render (sources, store, documents, jobStats, activities, percentiles, timeSeries, health)
- [ ] **Search functionality** (`/[slug]/[workspaceName]/search`): Execute search → filters work → URL state persists on refresh → AbortController cancellation works (submit multiple rapid searches)
- [ ] **AI chat** (`/[slug]/[workspaceName]/ask`): Send message → streaming response renders → message list scrolls → copy button works → suggestion clicks work
- [ ] **Jobs monitoring** (`/[slug]/[workspaceName]/jobs`): Jobs table loads → status tabs work → polling updates running jobs every 5s → restart button works
- [ ] **Workspace creation** (`/new`): Form validation works → GitHub connector installs → repository picker multi-select works → team name debounce works
- [ ] **Settings pages** (`/[slug]/[workspaceName]/settings`): Workspace general settings save correctly (uses `react-hook-form` + immer for optimistic updates)
- [ ] **Connector management** (`/[slug]/[workspaceName]/sources/connect`): Connect form provider context works → form validation with Zod resolves
- [ ] **Team switcher**: Organization dropdown opens → correct org highlighted from URL → switching works
- [ ] **Error boundaries**: Trigger an error (e.g., navigate to invalid workspace) → error boundary renders fallback

**Implementation Note**: If any route shows incorrect behavior (missing updates, stale data, broken interactions), note the specific component and route. These will be addressed in Phase 3 with `'use no memo'` directives or code fixes. Only proceed to Phase 3 after all critical routes are verified or issues documented.

---

## Phase 3: Fix Any Compiler Violations

### Overview
Address any ESLint violations flagged by `eslint-plugin-react-compiler` and fix any runtime issues discovered in Phase 2. If specific components are incompatible, add `'use no memo'` directives to opt them out.

### Changes Required:

#### 1. Run ESLint and collect violations
```bash
pnpm --filter @lightfast/console lint 2>&1 | grep "react-compiler"
```

#### 2. For each violation, determine the fix

**Common patterns that break React Compiler** (from web research):

a) **Prop destructuring with reassignment**:
```typescript
// BREAKS:
function Component({ value }) {
  value ??= defaultValue; // Reassigning destructured prop
}

// FIX:
function Component({ value: valueProp }) {
  const value = valueProp ?? defaultValue;
}
```

b) **Try-catch with template literals**:
```typescript
// May break:
catch(error) {
  setError(`${error}`);
}

// FIX:
catch(error) {
  setError(String(error));
}
```

c) **Complex conditional expressions in render**:
If the compiler can't analyze a complex expression, it silently skips the component. The ESLint plugin will flag these.

#### 3. For truly incompatible components, opt out

If a component cannot be fixed (e.g., library incompatibility with react-hook-form):

```typescript
'use no memo';
// Rest of component code
```

**Known risk areas to check**:
- `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx` - react-hook-form + Context hybrid
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/_components/connect-form-provider.tsx` - react-hook-form with Zod
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/settings/_components/workspace-general-settings-client.tsx` - react-hook-form + immer
- `apps/console/src/app/(app)/(user)/new/_components/repository-picker.tsx` - popup window polling pattern

### Success Criteria:

#### Automated Verification:
- [x] Zero ESLint violations from `react-compiler/react-compiler` rule: `pnpm --filter @lightfast/console lint`
- [x] Build completes: `pnpm build:console`
- [x] Type checking passes: `pnpm --filter @lightfast/console typecheck`

#### Manual Verification:
- [ ] Re-test any routes that had issues in Phase 2 - confirm fixes resolve them
- [ ] Any `'use no memo'` components still function correctly

**Implementation Note**: After completing this phase, all violations should be resolved. The compiler should be fully operational. Proceed to Phase 4 for cleanup.

---

## Phase 4: Clean Up Redundant Manual Memoization

### Overview
Remove `useMemo`, `useCallback`, and `React.memo` wrappers that are now redundant since React Compiler handles memoization automatically. This simplifies code and reduces cognitive overhead for future development.

### Changes Required:

#### 1. Remove `React.memo` wrappers (2 instances)

**File**: `apps/console/src/components/answer-messages.tsx`

**Line 71** - Remove memo wrapper from `UserMessage`:
```typescript
// Before:
const UserMessage = memo(function UserMessage({ message }: { message: UIMessage }) {
  // ...
});

// After:
function UserMessage({ message }: { message: UIMessage }) {
  // ...
}
```

**Line 94** - Remove memo wrapper from `AssistantMessage`:
```typescript
// Before:
const AssistantMessage = memo(function AssistantMessage({ message, isCurrentlyStreaming }: { ... }) {
  // ...
});

// After:
function AssistantMessage({ message, isCurrentlyStreaming }: { ... }) {
  // ...
}
```

Also remove the `memo` import from `react` at the top of the file.

#### 2. Remove `useCallback` wrappers (8 instances)

**File**: `apps/console/src/components/answer-interface.tsx` (3 instances)
- **Line 44**: `handleSendMessage` - unwrap useCallback, convert to plain function
- **Line 90**: `handleSubmit` - unwrap useCallback
- **Line 104**: `handleSuggestionClick` - unwrap useCallback

**File**: `apps/console/src/components/workspace-search.tsx` (4 instances)
- **Line 93**: `performSearch` - unwrap useCallback
- **Line 182**: `handleSearch` - unwrap useCallback
- **Line 186**: `handlePromptSubmit` - unwrap useCallback
- **Line 197**: `handleKeyDown` - unwrap useCallback

**File**: `apps/console/src/components/actor-filter.tsx` (1 instance)
- **Line 46**: `toggleActor` - unwrap useCallback

**Pattern for each removal**:
```typescript
// Before:
const handleFoo = useCallback((arg: string) => {
  doSomething(arg, dep1, dep2);
}, [dep1, dep2]);

// After:
const handleFoo = (arg: string) => {
  doSomething(arg, dep1, dep2);
};
```

Also remove unused `useCallback` imports from each file.

#### 3. Remove `useMemo` wrappers (11 instances)

**File**: `apps/console/src/components/answer-messages.tsx` (1 instance)
- **Line 270**: `turns` computation - unwrap useMemo

**File**: `apps/console/src/components/team-switcher.tsx` (2 instances)
- **Line 46**: `currentOrgSlug` - unwrap useMemo
- **Line 58**: `currentOrg` - unwrap useMemo

**File**: `apps/console/src/components/workspace-switcher.tsx` (2 instances)
- **Line 39**: `currentOrg` - unwrap useMemo
- **Line 56**: `currentWorkspace` - unwrap useMemo

**File**: `apps/console/src/components/performance-metrics.tsx` (1 instance)
- **Line 23**: `chartData` - unwrap useMemo

**File**: `apps/console/src/components/user-dropdown-menu.tsx` (3 instances)
- **Line 32**: `_displayName` - unwrap useMemo
- **Line 46**: `emailAddress` - unwrap useMemo
- **Line 59**: `initials` - unwrap useMemo

**File**: `apps/console/src/ai/hooks/use-answer-transport.ts` (1 instance)
- **Line 13**: transport object - unwrap useMemo

**File**: `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx` (1 instance)
- **Line 38**: `installations` - unwrap useMemo

**Pattern for each removal**:
```typescript
// Before:
const derivedValue = useMemo(() => {
  return expensiveComputation(dep1, dep2);
}, [dep1, dep2]);

// After:
const derivedValue = expensiveComputation(dep1, dep2);
```

Also remove unused `useMemo` imports from each file.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [x] ESLint passes: `pnpm --filter @lightfast/console lint`
- [x] Build completes: `pnpm build:console`
- [x] No unused imports (eslint should catch `useMemo`, `useCallback`, `memo` if no longer used)

#### Manual Verification:
- [ ] **Message list performance**: AI chat with 20+ messages renders smoothly (memo removal on UserMessage/AssistantMessage)
- [ ] **Search responsiveness**: Rapid typing in search doesn't cause excessive re-renders (useCallback removal on performSearch)
- [ ] **Team/workspace switchers**: URL-based state derivation still works (useMemo removal on currentOrg)
- [ ] **Dashboard charts**: Performance metrics chart still renders without lag (useMemo removal on chartData)
- [ ] **Transport stability**: AI chat streaming still works after transport useMemo removal

**Implementation Note**: If any performance regression is noticeable after removing a specific `useMemo` or `React.memo`, add it back. The compiler should handle these cases, but if it doesn't (silent failure), the manual optimization is still the correct approach. Document any cases where manual memoization was re-added.

---

## Testing Strategy

### Automated Tests:
- Type checking: `pnpm --filter @lightfast/console typecheck`
- Linting: `pnpm --filter @lightfast/console lint`
- Build: `pnpm build:console`

### Integration Testing:
- All critical routes tested in Phase 2 manual verification
- Focus areas: forms (react-hook-form), streaming (AI chat), polling (jobs), URL state (search)

### Performance Testing:
After all phases:
1. Record build time with compiler vs baseline
2. Run `ANALYZE=true pnpm build:console` for bundle comparison
3. Lighthouse audit on `/[slug]/[workspaceName]` (dashboard) and `/[slug]/[workspaceName]/search` (heaviest client component)

## Performance Considerations

- **Build time**: Will increase due to Babel dependency. Measured but no strict limit.
- **Runtime**: Expected 5-15% improvement from automatic memoization, especially on heavy components (workspace-search, answer-messages, workspace-dashboard)
- **Bundle size**: Negligible change - React Compiler is a compile-time optimization, not a code-splitting one
- **Dev server**: HMR may be slightly slower due to Babel in the pipeline. Monitor subjectively.

## Migration Notes

No data migration required. All changes are build-time configuration and code cleanup.

**Rollback strategy**: Remove `experimental.reactCompiler: true` from `next.config.ts` and revert the ESLint plugin. Manual memoization removal (Phase 4) would need to be reverted via git if the compiler is disabled, so commit Phase 4 as a separate commit for easy revert.

**Commit strategy**:
- Commit 1: Phase 1 (dependencies + config)
- Commit 2: Phase 3 (any violation fixes / `'use no memo'` directives)
- Commit 3: Phase 4 (manual memoization cleanup) - separate for easy revert

## References

- Current config: `apps/console/next.config.ts:1-129`
- Vendor merge utility: `vendor/next/src/merge-config.ts:80-152`
- ESLint config: `apps/console/eslint.config.js`
- Error boundaries (auto-skipped): `apps/console/src/components/errors/`
- Zustand store (compatible): `apps/console/src/stores/dashboard-preferences.ts`
- Form providers (risk area): `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`
- Heaviest client component: `apps/console/src/components/workspace-search.tsx`
- Message memoization: `apps/console/src/components/answer-messages.tsx:71,94`
- Research: `thoughts/shared/research/2026-02-09-react-compiler-enabling-for-apps-console.md`
- Optimization context: `thoughts/shared/plans/2026-02-09-console-next-config-optimizations.md`
- React Compiler docs: https://react.dev/learn/react-compiler
- Next.js config docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler
- Known TanStack Table issue: https://github.com/facebook/react/issues/33057
- Silent failures reference: https://acusti.ca/blog/2025/12/16/react-compiler-silent-failures-and-how-to-fix-them/
