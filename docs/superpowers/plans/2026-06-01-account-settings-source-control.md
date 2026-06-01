# Account Settings: Source Control route + connector-style General — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the personal GitHub connection out of account General into a new `Source Control & Git` route, and upgrade General to the workspace `SettingsGroup`/`SettingRow` connector-style pattern.

**Architecture:** Mirror the already-shipped workspace settings (`[slug]/(workspace)/(manage)/settings`). Promote the row primitives to a shared `apps/app/src/components/settings-section.tsx`, add an account-level `source-control` route with a `GithubAccountCard` modeled on the workspace `OrganizationCard`, and restyle the General page. No server/tRPC changes.

**Tech Stack:** Next.js App Router (RSC + client islands), tRPC (`viewer.githubAccount.status`, `viewer.account.get`), `@tanstack/react-query` `useSuspenseQuery`, `@repo/ui` (shadcn), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-01-account-settings-source-control-design.md`

**Branch:** work in-place on `feat/connectors-linear-mcp` (no worktree). Commit only the files named in each task via explicit pathspec — a concurrent writer may stage unrelated in-flight work.

**Run tests with:** `cd apps/app && pnpm with-env vitest run <path>` (or `pnpm --filter @lightfast/app test` for the full suite). Typecheck: `pnpm --filter @lightfast/app typecheck`.

---

## File structure

| Action | Path | Responsibility |
| --- | --- | --- |
| Create | `apps/app/src/components/settings-section.tsx` | Shared `SettingsGroup` + `SettingRow` primitives |
| Modify | `…/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx` | Import primitives from shared path |
| Delete | `…/[slug]/(workspace)/(manage)/settings/_components/settings-section.tsx` | Superseded by shared file |
| Create | `…/account/settings/source-control/page.tsx` | RSC: prefetch GitHub status + hydrate |
| Create | `…/account/settings/source-control/_components/account-source-control-client.tsx` | Client island: header + connected/empty branch |
| Create | `…/account/settings/source-control/_components/github-account-card.tsx` | Connector card (mirrors `OrganizationCard`) |
| Modify | `…/account/settings/general/_components/profile-data-display.tsx` | Profile group rows; drop GitHub section |
| Modify | `…/account/settings/general/_components/profile-data-loading.tsx` | Skeleton matching new layout |
| Modify | `…/account/settings/general/page.tsx` | Drop `githubAccount.status` prefetch |
| Delete | `…/account/settings/general/_components/github-account-connection-section.tsx` | Moved to source-control route |
| Modify | `…/account/settings/layout.tsx` | Add sidebar item + `max-w-4xl` content |
| Create | `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-source-control.test.tsx` | Tests for new route + card |
| Create | `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general.test.tsx` | Tests for upgraded General |
| Delete | `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx` | Replaced by the two above |
| Modify | `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx` | Assert new sidebar item |

`…` = `apps/app/src/app/(app)/(pending-allowed)` or `apps/app/src/app/(app)/(pending-not-allowed)` as shown.

---

## Task 1: Promote shared `settings-section.tsx` primitives

**Files:**
- Create: `apps/app/src/components/settings-section.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx`
- Delete: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/settings-section.tsx`

- [ ] **Step 1: Confirm the only importer**

Run: `cd /Users/jeevanpillay/Code/@lightfastai/lightfast && grep -rn "settings-section" apps/app/src --include="*.tsx" --include="*.ts"`
Expected: the only import is in `team-general-settings-client.tsx` (`./settings-section`). If others appear, add them to Step 3.

- [ ] **Step 2: Create the shared file**

Create `apps/app/src/components/settings-section.tsx` (verbatim move):

```tsx
import type { ReactNode } from "react";

export function SettingsGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section>
      <h3 className="font-semibold text-base text-foreground">{title}</h3>
      <div className="mt-2 divide-y divide-border/55">{children}</div>
    </section>
  );
}

export function SettingRow({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description?: string;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-foreground text-sm">{label}</p>
        {description ? (
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Repoint the workspace import**

In `…/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx`, change:

```tsx
import { SettingRow, SettingsGroup } from "./settings-section";
```
to:
```tsx
import { SettingRow, SettingsGroup } from "~/components/settings-section";
```

- [ ] **Step 4: Delete the old colocated file**

Run: `cd /Users/jeevanpillay/Code/@lightfastai/lightfast && git rm "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/settings-section.tsx"`

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS (no unresolved `./settings-section`).

- [ ] **Step 6: Commit**

```bash
git add "apps/app/src/components/settings-section.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/settings-section.tsx"
git commit -m "refactor(settings): promote SettingsGroup/SettingRow to shared component" -- \
  "apps/app/src/components/settings-section.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/settings-section.tsx"
```

(Append the Co-Authored-By trailer required by the harness when committing.)

---

## Task 2: Account-level GitHub connector route

**Files:**
- Create: `apps/app/src/app/(app)/(pending-allowed)/account/settings/source-control/_components/github-account-card.tsx`
- Create: `apps/app/src/app/(app)/(pending-allowed)/account/settings/source-control/_components/account-source-control-client.tsx`
- Create: `apps/app/src/app/(app)/(pending-allowed)/account/settings/source-control/page.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-source-control.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-source-control.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let githubAccountStatus: {
  account: null | {
    accessTokenExpiresAt: Date;
    connectedAt: Date;
    provider: "github";
    providerUserId: string;
    refreshTokenExpiresAt: Date;
    status: "active";
  };
} = { account: null };

const statusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));
const prefetchMock = vi.fn();
const serverStatusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      githubAccount: { status: { queryOptions: statusQueryOptionsMock } },
    },
  }),
}));

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => <>{children}</>,
  prefetch: prefetchMock,
  trpc: {
    viewer: {
      githubAccount: { status: { queryOptions: serverStatusQueryOptionsMock } },
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({ data: githubAccountStatus }),
}));

const { AccountSourceControlClient } = await import(
  "~/app/(app)/(pending-allowed)/account/settings/source-control/_components/account-source-control-client"
);

beforeEach(() => {
  githubAccountStatus = { account: null };
  statusQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
  serverStatusQueryOptionsMock.mockClear();
});

describe("AccountSourceControlClient", () => {
  it("offers a connect CTA when no account is linked", () => {
    render(<AccountSourceControlClient />);

    expect(
      screen.getByRole("heading", { name: /source control & git/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /connect github account/i })
    ).toHaveAttribute("href", "/account/tasks/github");
  });

  it("renders the connector card with the GitHub user id when linked", () => {
    githubAccountStatus = {
      account: {
        accessTokenExpiresAt: new Date("2026-07-01T00:00:00Z"),
        connectedAt: new Date("2026-06-01T00:00:00Z"),
        provider: "github",
        providerUserId: "12345",
        refreshTokenExpiresAt: new Date("2026-12-01T00:00:00Z"),
        status: "active",
      },
    };

    render(<AccountSourceControlClient />);

    // The card shows the linked identity + the "Connected" status pill trigger.
    // "View GitHub setup" lives inside a closed Radix dropdown, so it is not in
    // the DOM until opened — assert only on the visible card content here.
    expect(screen.getByText("github:12345")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /connected/i })
    ).toBeVisible();
    expect(screen.queryByText(/connect github account/i)).not.toBeInTheDocument();
  });

  it("prefetches the GitHub account status for the page", async () => {
    const { default: SourceControlPage } = await import(
      "~/app/(app)/(pending-allowed)/account/settings/source-control/page"
    );

    render(SourceControlPage());

    expect(prefetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [["viewer", "githubAccount", "status"]],
      })
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-allowed)/account/settings-source-control.test.tsx"`
Expected: FAIL — cannot resolve `account-source-control-client` / `page`.

- [ ] **Step 3: Create the connector card**

Create `…/account/settings/source-control/_components/github-account-card.tsx`:

```tsx
"use client";

import type { AppRouterOutputs } from "@api/app";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { ChevronDown, Settings, Unplug } from "lucide-react";
import Link from "next/link";

type GithubUserAccount = NonNullable<
  AppRouterOutputs["viewer"]["githubAccount"]["status"]["account"]
>;

const GITHUB_ACCOUNT_TASK_HREF = "/account/tasks/github";
const DISCONNECT_TOOLTIP = "Connection is managed from the GitHub setup task.";

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatConnectedAt(value: Date): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }
  return `Connected on ${shortDateFormatter.format(value)}`;
}

export function GithubAccountCard({
  account,
}: {
  account: GithubUserAccount;
}) {
  const subtitle = formatConnectedAt(account.connectedAt);

  return (
    <section className="flex items-center justify-between gap-4 rounded-[8px] border border-border bg-background p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-input bg-background">
          <Icons.github aria-hidden="true" className="size-4 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-foreground text-sm">
            {account.provider}:{account.providerUserId}
          </p>
          {subtitle ? (
            <p className="text-muted-foreground text-xs">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="h-7 rounded-[9px]"
            size="sm"
            type="button"
            variant="outline"
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-emerald-500"
            />
            Connected
            <ChevronDown aria-hidden="true" className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link
              href={{ pathname: GITHUB_ACCOUNT_TASK_HREF }}
              prefetch={true}
            >
              <Settings aria-hidden="true" className="size-4" />
              View GitHub setup
            </Link>
          </DropdownMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <DropdownMenuItem disabled variant="destructive">
                  <Unplug aria-hidden="true" className="size-4" />
                  Disconnect
                </DropdownMenuItem>
              </div>
            </TooltipTrigger>
            <TooltipContent>{DISCONNECT_TOOLTIP}</TooltipContent>
          </Tooltip>
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  );
}
```

- [ ] **Step 4: Create the client island**

Create `…/account/settings/source-control/_components/account-source-control-client.tsx`:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTRPC } from "~/trpc/react";
import { GithubAccountCard } from "./github-account-card";

const GITHUB_ACCOUNT_TASK_HREF = "/account/tasks/github";

export function AccountSourceControlClient() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.viewer.githubAccount.status.queryOptions()
  );
  const account = data.account;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          Source Control &amp; Git
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Connect your personal GitHub identity so Lightfast can set up
          user-level source-control access for future workflows that act on your
          behalf.
        </p>
      </div>

      {account ? (
        <GithubAccountCard account={account} />
      ) : (
        <div className="rounded-[8px] border border-border bg-background p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground text-sm">
                No GitHub account connected
              </p>
              <p className="text-muted-foreground text-sm">
                Setup is optional today. Future GitHub-powered actions will ask
                for this connection before they run as your GitHub user.
              </p>
            </div>
            <Button
              asChild
              className="h-7 rounded-[9px]"
              size="sm"
              variant="secondary"
            >
              <Link
                href={{ pathname: GITHUB_ACCOUNT_TASK_HREF }}
                prefetch={true}
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                Connect GitHub account
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create the page**

Create `…/account/settings/source-control/page.tsx`:

```tsx
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export const dynamic = "force-dynamic";

import { AccountSourceControlClient } from "./_components/account-source-control-client";

export default function AccountSourceControlPage() {
  prefetch(trpc.viewer.githubAccount.status.queryOptions());

  return (
    <HydrateClient>
      <AccountSourceControlClient />
    </HydrateClient>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-allowed)/account/settings-source-control.test.tsx"`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-allowed)/account/settings/source-control" \
  "apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-source-control.test.tsx"
git commit -m "feat(account-settings): add Source Control & Git route with GitHub connector card" -- \
  "apps/app/src/app/(app)/(pending-allowed)/account/settings/source-control" \
  "apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-source-control.test.tsx"
```

---

## Task 3: Upgrade General page + remove inline GitHub

**Files:**
- Modify: `…/account/settings/general/_components/profile-data-display.tsx`
- Modify: `…/account/settings/general/_components/profile-data-loading.tsx`
- Modify: `…/account/settings/general/page.tsx`
- Delete: `…/account/settings/general/_components/github-account-connection-section.tsx`
- Create: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general.test.tsx`
- Delete: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clientAccountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "account", "get"]],
}));
const prefetchMock = vi.fn();
const accountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "account", "get"]],
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      account: { get: { queryOptions: clientAccountGetQueryOptionsMock } },
    },
  }),
}));

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => <>{children}</>,
  prefetch: prefetchMock,
  trpc: {
    viewer: {
      account: { get: { queryOptions: accountGetQueryOptionsMock } },
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({
    data: {
      fullName: "Test User",
      initials: "TU",
      primaryEmailAddress: "test@example.com",
    },
  }),
}));

const { ProfileDataDisplay } = await import(
  "~/app/(app)/(pending-allowed)/account/settings/general/_components/profile-data-display"
);

beforeEach(() => {
  clientAccountGetQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
  accountGetQueryOptionsMock.mockClear();
});

describe("account General settings", () => {
  it("renders profile rows without the GitHub section", () => {
    render(<ProfileDataDisplay />);

    expect(
      screen.getByRole("heading", { name: "General" })
    ).toBeInTheDocument();
    expect(screen.getByText("Display name")).toBeVisible();
    expect(screen.getByText("Email")).toBeVisible();
    expect(screen.getByDisplayValue("Test User")).toBeVisible();
    expect(screen.getByDisplayValue("test@example.com")).toBeVisible();
    expect(screen.queryByText(/github/i)).not.toBeInTheDocument();
  });

  it("prefetches only the account profile for the General page", async () => {
    const { default: GeneralSettingsPage } = await import(
      "~/app/(app)/(pending-allowed)/account/settings/general/page"
    );

    render(<GeneralSettingsPage />);

    expect(prefetchMock).toHaveBeenCalledTimes(1);
    expect(prefetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [["viewer", "account", "get"]],
      })
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-allowed)/account/settings-general.test.tsx"`
Expected: FAIL — current `ProfileDataDisplay` renders a GitHub section (the `queryByText(/github/i)` assertion fails) and current page prefetches twice.

- [ ] **Step 3: Rewrite `profile-data-display.tsx`**

Replace the whole file with:

```tsx
"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Input } from "@repo/ui/components/ui/input";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SettingRow, SettingsGroup } from "~/components/settings-section";
import { useTRPC } from "~/trpc/react";

export function ProfileDataDisplay() {
  const trpc = useTRPC();

  const { data: profile } = useSuspenseQuery({
    ...trpc.viewer.account.get.queryOptions(),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-medium font-pp text-foreground text-xl">General</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your personal account settings.
        </p>
      </div>

      <SettingsGroup title="Profile">
        <SettingRow label="Avatar">
          <Avatar className="size-7">
            <AvatarFallback className="bg-foreground text-background text-xs">
              {profile.initials}
            </AvatarFallback>
          </Avatar>
        </SettingRow>

        <SettingRow
          description="Please enter your full name, or a display name you are comfortable with."
          label="Display name"
        >
          <Input
            className="w-64 bg-muted/50"
            disabled
            readOnly
            size="lf"
            type="text"
            value={profile.fullName ?? ""}
            variant="lf"
          />
        </SettingRow>

        <SettingRow description="Your primary email address." label="Email">
          <Input
            className="w-64 bg-muted/50"
            disabled
            readOnly
            size="lf"
            type="email"
            value={profile.primaryEmailAddress ?? ""}
            variant="lf"
          />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `profile-data-loading.tsx` to match the new layout**

Replace the whole file with:

```tsx
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { SettingRow, SettingsGroup } from "~/components/settings-section";

export function ProfileDataLoading() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-medium font-pp text-foreground text-xl">General</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your personal account settings.
        </p>
      </div>

      <SettingsGroup title="Profile">
        <SettingRow label="Avatar">
          <Skeleton className="size-7 rounded-full" />
        </SettingRow>
        <SettingRow
          description="Please enter your full name, or a display name you are comfortable with."
          label="Display name"
        >
          <Skeleton className="h-7 w-64" />
        </SettingRow>
        <SettingRow description="Your primary email address." label="Email">
          <Skeleton className="h-7 w-64" />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
```

- [ ] **Step 5: Drop the GitHub prefetch in `general/page.tsx`**

Replace the whole file with:

```tsx
import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export const dynamic = "force-dynamic";

import { ProfileDataDisplay } from "./_components/profile-data-display";
import { ProfileDataLoading } from "./_components/profile-data-loading";

export default function GeneralSettingsPage() {
  // CRITICAL: Prefetch BEFORE HydrateClient wrapping
  prefetch(trpc.viewer.account.get.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={<ProfileDataLoading />}>
        <ProfileDataDisplay />
      </Suspense>
    </HydrateClient>
  );
}
```

- [ ] **Step 6: Delete the moved component and its old test**

Run:
```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
git rm "apps/app/src/app/(app)/(pending-allowed)/account/settings/general/_components/github-account-connection-section.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx"
```

- [ ] **Step 7: Run the General test to verify it passes**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-allowed)/account/settings-general.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-allowed)/account/settings/general" \
  "apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general.test.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx"
git commit -m "feat(account-settings): connector-style General page, GitHub moved to Source Control" -- \
  "apps/app/src/app/(app)/(pending-allowed)/account/settings/general" \
  "apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general.test.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-general-github-section.test.tsx"
```

---

## Task 4: Account settings sidebar + content width

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-allowed)/account/settings/layout.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx`

- [ ] **Step 1: Update the layout test**

In `settings-layout.test.tsx`, replace the third `it(...)` block ("keeps GitHub setup out of the settings sidebar for the setup-only pass") with:

```tsx
  it("lists General and Source Control & Git in the settings sidebar", () => {
    const element = AccountSettingsLayout({
      children: <div>Account settings page</div>,
    });

    render(element);

    expect(screen.getByText("General")).toBeVisible();
    expect(screen.getByText("Source Control & Git")).toBeVisible();
    expect(screen.queryByText("Connections")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx"`
Expected: FAIL — `getByText("Source Control & Git")` not found.

- [ ] **Step 3: Add the sidebar item and content max-width**

In `…/account/settings/layout.tsx`:

Change the sidebar items:
```tsx
          <SettingsSidebar
            basePath="/account/settings"
            items={[{ name: "General", path: "general" }]}
          />
```
to:
```tsx
          <SettingsSidebar
            basePath="/account/settings"
            items={[
              { name: "General", path: "general" },
              { name: "Source Control & Git", path: "source-control" },
            ]}
          />
```

Change the content wrapper:
```tsx
          <div className="min-w-0 flex-1">{children}</div>
```
to:
```tsx
          <div className="min-w-0 max-w-4xl flex-1">{children}</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx"`
Expected: PASS (the `pl-3` / `pt-2 pb-8` header assertions still hold; the new sidebar assertion passes).

- [ ] **Step 5: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-allowed)/account/settings/layout.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx"
git commit -m "feat(account-settings): add Source Control & Git sidebar item" -- \
  "apps/app/src/app/(app)/(pending-allowed)/account/settings/layout.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-allowed)/account/settings-layout.test.tsx"
```

---

## Task 5: Full verification

- [ ] **Step 1: Typecheck the app**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS.

- [ ] **Step 2: Run the account settings test suite**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-allowed)/account"`
Expected: PASS — `settings-layout`, `settings-general`, `settings-source-control`, plus the untouched `tasks/github/*` tests.

- [ ] **Step 3: Lint the touched files**

Run: `pnpm check`
Expected: PASS (or only pre-existing warnings unrelated to these files).

- [ ] **Step 4: Manual smoke (optional, dev server running)**

Visit `https://app.lightfast.localhost/account/settings/general` → Profile group (Avatar / Display name / Email), no GitHub block.
Visit `https://app.lightfast.localhost/account/settings/source-control` → connector card when linked ("github:<id>", "Connected" dropdown with enabled "View GitHub setup", disabled "Disconnect"); empty-state "Connect GitHub account" when not linked. Sidebar shows both items; clicking navigates.

---

## Self-review notes

- **Spec coverage:** separate route (Task 2 + 4), connector card with disabled disconnect (Task 2), General upgrade + GitHub removal (Task 3), shared primitives (Task 1), tests for all (Tasks 2–4). All spec sections mapped.
- **Type consistency:** `GithubUserAccount` derived from `AppRouterOutputs["viewer"]["githubAccount"]["status"]["account"]`; card consumes `account.provider`, `account.providerUserId`, `account.connectedAt` — all present on that type. `SettingsGroup`/`SettingRow` signatures identical across shared file and both consumers.
- **No placeholders:** every step ships complete code or an exact command.
- **Behavior parity:** the only enabled action remains routing to `/account/tasks/github`; disconnect stays disabled with a tooltip, matching the workspace card.
