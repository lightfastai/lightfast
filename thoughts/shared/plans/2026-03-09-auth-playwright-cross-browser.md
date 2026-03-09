# Auth Playwright Cross-Browser Coverage Plan

## Overview

Add Firefox and WebKit browser projects to the auth app's Playwright config, gated behind `process.env.CI` so only Chromium runs locally while all three browsers run in CI.

## Current State Analysis

The Playwright config at `apps/auth/playwright.config.ts` (lines 19-24) only defines a single Chromium project:

```ts
projects: [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
],
```

This is the only Playwright config in the monorepo (others are in `tmp/` from cloned repos).

## Desired End State

The auth app's E2E tests run against Chromium locally and against Chromium + Firefox + WebKit in CI, providing broad browser coverage without slowing down local development.

## What We're NOT Doing

- Adding mobile device viewports (e.g., iPhone, Pixel)
- Adding CI pipeline configuration (just the Playwright config gate)
- Changing any other Playwright settings (retries, workers, reporter, etc.)

## Implementation

### Phase 1: Add CI-Gated Browser Projects

#### Changes Required

**File**: `apps/auth/playwright.config.ts`

Replace the `projects` array (lines 19-24) with:

```ts
projects: [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
  ...(process.env.CI
    ? [
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
      ]
    : []),
],
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/auth typecheck`
- [x] Auth app builds: `pnpm build:auth`

#### Manual Verification:
- [x] Local run (`pnpm --filter @lightfast/auth test:e2e` or equivalent) only shows Chromium project
- [x] With `CI=true` prefix, all three browsers appear in the test run

## References

- Playwright config: `apps/auth/playwright.config.ts`
- [Playwright projects docs](https://playwright.dev/docs/test-projects)
