# Account General GitHub Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a setup-only GitHub account connection section to Account General settings that routes users into the existing `/account/tasks/github` binding flow.

**Architecture:** Reuse the existing `viewer.githubAccount.status` query and `/account/tasks/github` OAuth task page. Add one focused client component to the General settings page, hydrate the GitHub account status from the server page, and keep disconnect/revocation UI out of scope for this pass.

**Tech Stack:** Next.js App Router, React 19, `@trpc/tanstack-react-query`, Vitest, Testing Library, pnpm workspace.

---

## File Structure

- Create: `apps/app/src/app/(app)/(pending-allowed)/account/settings/general/_components/github-account-connection-section.tsx`
  - Client component responsible only for rendering GitHub connection status and linking to `/account/tasks/github`.
- Modify: `apps/app/src/app/(app)/(pending-allowed)/account/settings/general/_components/profile-data-display.tsx`
  - Render the GitHub connection section after the Email section.
- Modify: `apps/app/src/app/(app)/(pending-allowed)/account/settings/general/_components/profile-data-loading.tsx`
  - Add a matching skeleton row so the General settings loading state does not jump.
- Modify: `apps/app/src/app/(app)/(pending-allowed)/account/settings/general/page.tsx`
  - Prefetch `viewer.githubAccount.status` before `HydrateClient`.
- Create: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx`
  - Component-level tests for disconnected and connected status states.
- Modify: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx`
  - Add a narrow assertion that the account settings sidebar remains General-only in this pass; `/account/tasks/github` is linked from the General content, not added as a new settings tab.

## Task 1: Write The General Settings GitHub Section Tests

**Files:**
- Create: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx`

- [ ] **Step 1: Create the failing component test**

Add this file:

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let githubAccountStatus: {
  account: null | {
    provider: "github";
    providerUserId: string;
    status: "active";
  };
} = { account: null };

const statusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      githubAccount: {
        status: { queryOptions: statusQueryOptionsMock },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({
    data: githubAccountStatus,
  }),
}));

const { GithubAccountConnectionSection } = await import(
  "~/app/(app)/(pending-allowed)/account/settings/general/_components/github-account-connection-section"
);

beforeEach(() => {
  githubAccountStatus = { account: null };
  statusQueryOptionsMock.mockClear();
});

describe("GithubAccountConnectionSection", () => {
  it("links disconnected users to the GitHub account task", () => {
    render(<GithubAccountConnectionSection />);

    expect(
      screen.getByRole("heading", { name: "GitHub account" })
    ).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeVisible();

    const link = screen.getByRole("link", {
      name: /connect github account/i,
    });
    expect(link).toHaveAttribute("href", "/account/tasks/github");
    expect(statusQueryOptionsMock).toHaveBeenCalledTimes(1);
  });

  it("shows the connected GitHub user id and keeps setup routing available", () => {
    githubAccountStatus = {
      account: {
        provider: "github",
        providerUserId: "12345",
        status: "active",
      },
    };

    render(<GithubAccountConnectionSection />);

    expect(screen.getByText("Connected")).toBeVisible();
    expect(screen.getByText("github:12345")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /view github setup/i })
    ).toHaveAttribute("href", "/account/tasks/github");
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx'
```

Expected: FAIL because `github-account-connection-section` does not exist yet.

## Task 2: Implement The GitHub Account Section

**Files:**
- Create: `apps/app/src/app/(app)/(pending-allowed)/account/settings/general/_components/github-account-connection-section.tsx`

- [ ] **Step 1: Add the client component**

Create the component:

```tsx
"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useTRPC } from "~/trpc/react";

const GITHUB_ACCOUNT_TASK_HREF = "/account/tasks/github";

export function GithubAccountConnectionSection() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.viewer.githubAccount.status.queryOptions()
  );
  const account = data.account;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-foreground text-xl">
            GitHub account
          </h2>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm">
            Connect your personal GitHub identity so Lightfast can set up
            user-level source-control access for future workflows that act on
            your behalf.
          </p>
        </div>

        <Button asChild className="w-full sm:w-auto" variant="secondary">
          <Link href={{ pathname: GITHUB_ACCOUNT_TASK_HREF }} prefetch={true}>
            <Icons.github aria-hidden="true" className="h-4 w-4" />
            {account ? "View GitHub setup" : "Connect GitHub account"}
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        {account ? (
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <CheckCircle2
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-foreground"
            />
            <div className="min-w-0">
              <p className="font-medium text-foreground">Connected</p>
              <p className="truncate font-mono text-muted-foreground">
                {account.provider}:{account.providerUserId}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-sm">
            <p className="font-medium text-foreground">Not connected</p>
            <p className="mt-1 text-muted-foreground">
              Setup is optional today. Future GitHub-powered actions will ask
              for this connection before they run as your GitHub user.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run the component test and verify GREEN**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx'
```

Expected: PASS.

- [ ] **Step 3: Commit the component and test**

```bash
git add 'apps/app/src/app/(app)/(pending-allowed)/account/settings/general/_components/github-account-connection-section.tsx' 'apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx'
git commit -m "feat: add github account setup section"
```

## Task 3: Wire The Section Into General Settings

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-allowed)/account/settings/general/_components/profile-data-display.tsx`
- Modify: `apps/app/src/app/(app)/(pending-allowed)/account/settings/general/_components/profile-data-loading.tsx`
- Modify: `apps/app/src/app/(app)/(pending-allowed)/account/settings/general/page.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx`

- [ ] **Step 1: Extend the test to cover page prefetching**

Append this mock setup near the top of `settings-general-github-section.test.tsx`:

```tsx
const prefetchMock = vi.fn();
const accountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "account", "get"]],
}));
const serverGithubStatusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => <>{children}</>,
  prefetch: prefetchMock,
  trpc: {
    viewer: {
      account: {
        get: { queryOptions: accountGetQueryOptionsMock },
      },
      githubAccount: {
        status: { queryOptions: serverGithubStatusQueryOptionsMock },
      },
    },
  },
}));
```

Add this test:

```tsx
it("prefetches account and GitHub status for the General settings page", async () => {
  const { default: GeneralSettingsPage } = await import(
    "~/app/(app)/(pending-allowed)/account/settings/general/page"
  );

  render(<GeneralSettingsPage />);

  expect(prefetchMock).toHaveBeenCalledWith({
    queryKey: [["viewer", "account", "get"]],
  });
  expect(prefetchMock).toHaveBeenCalledWith({
    queryKey: [["viewer", "githubAccount", "status"]],
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx'
```

Expected: FAIL because the page prefetches only `viewer.account.get`.

- [ ] **Step 3: Wire the component into the General display**

In `profile-data-display.tsx`, add:

```tsx
import { GithubAccountConnectionSection } from "./github-account-connection-section";
```

Render it after the Email section:

```tsx
      <GithubAccountConnectionSection />
```

- [ ] **Step 4: Add a matching loading skeleton**

In `profile-data-loading.tsx`, add this section after the Email skeleton:

```tsx
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground text-xl">
            GitHub account
          </h2>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm">
            Connect your personal GitHub identity so Lightfast can set up
            user-level source-control access for future workflows that act on
            your behalf.
          </p>
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
```

- [ ] **Step 5: Prefetch GitHub status on the page**

In `page.tsx`, keep the existing account prefetch and add:

```tsx
  prefetch(trpc.viewer.githubAccount.status.queryOptions());
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx'
```

Expected: PASS.

- [ ] **Step 7: Commit the page wiring**

```bash
git add 'apps/app/src/app/(app)/(pending-allowed)/account/settings/general/_components/profile-data-display.tsx' 'apps/app/src/app/(app)/(pending-allowed)/account/settings/general/_components/profile-data-loading.tsx' 'apps/app/src/app/(app)/(pending-allowed)/account/settings/general/page.tsx' 'apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx'
git commit -m "feat: surface github setup in account settings"
```

## Task 4: Keep Navigation Scope Explicit

**Files:**
- Modify: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx`

- [ ] **Step 1: Add a layout test documenting that no new settings tab is added**

Add this test:

```tsx
it("keeps GitHub setup out of the settings sidebar for the setup-only pass", () => {
  const element = AccountSettingsLayout({
    children: <div>Account settings page</div>,
  });

  const serialized = JSON.stringify(element);

  expect(serialized).toContain("General");
  expect(serialized).not.toContain("Connections");
  expect(serialized).not.toContain("GitHub");
});
```

- [ ] **Step 2: Run the layout test**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx'
```

Expected: PASS.

- [ ] **Step 3: Commit the navigation scope test**

```bash
git add 'apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx'
git commit -m "test: document account github setup navigation scope"
```

## Task 5: Verification

**Files:**
- No production file changes.

- [ ] **Step 1: Run focused app tests**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx' 'src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx' 'src/__tests__/app/(app)/(pending-allowed)/account/tasks/github/github-account-task-page.test.tsx' 'src/__tests__/app/(app)/(pending-allowed)/account/tasks/github/github-account-complete-page.test.tsx'
```

Expected: PASS.

- [ ] **Step 2: Run app typecheck**

Run:

```bash
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 3: Run workspace check**

Run:

```bash
pnpm check
```

Expected: PASS or report concrete existing violations separately from this change.

- [ ] **Step 4: Review final diff**

Run:

```bash
git diff --stat
git diff -- 'apps/app/src/app/(app)/(pending-allowed)/account/settings/general' 'apps/app/src/__tests__/app/(app)/(pending-allowed)/account'
```

Expected: The diff only adds the General settings GitHub setup surface, test coverage, and the page prefetch.

## Out Of Scope For This Pass

- Disconnect or revoke controls in the UI.
- A new Account → Connections tab.
- Fetching GitHub login/avatar/profile data for display.
- New feature gates that require GitHub account binding.
- Any GitHub API action that uses `getFreshGitHubUserAccessToken`.
- Changes to the GitHub App permission model.
