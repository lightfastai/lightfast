import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const identityGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "identity", "get"],
}));
const useSuspenseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        identity: {
          get: {
            queryOptions: identityGetQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const { IdentitySoulCard } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/identity-soul-card"
);

// .lightfast connected: IDENTITY.md indexed, SOUL.md not indexed.
const configuredIdentity = {
  configured: true as const,
  repository: {
    defaultBranch: "main",
    id: "1",
    name: ".lightfast",
    owner: "lightfast-emulated",
  },
  state: {
    diagnostics: [],
    indexedCommitSha: "commit-main",
    indexedTreeSha: "tree-sha",
    lastCheckedAt: new Date("2026-06-01T00:00:00.000Z"),
    lastFailureAt: null,
    lastSuccessAt: new Date("2026-06-01T00:00:00.000Z"),
    status: "fresh",
  },
  files: [
    {
      contentHash: "sha256:abc",
      contentSha: "content-sha",
      diagnostics: [],
      githubUrl:
        "https://github.com/lightfast-emulated/.lightfast/blob/main/IDENTITY.md",
      indexedCommitSha: "commit-main",
      kind: "identity",
      label: "Identity",
      path: "IDENTITY.md",
      size: 8,
      sourceMarkdown: "# Acme",
      status: "present",
    },
    {
      contentHash: null,
      contentSha: null,
      diagnostics: ["SOUL.md is missing."],
      githubUrl:
        "https://github.com/lightfast-emulated/.lightfast/blob/main/SOUL.md",
      indexedCommitSha: null,
      kind: "soul",
      label: "Soul",
      path: "SOUL.md",
      size: null,
      sourceMarkdown: null,
      status: "missing",
    },
  ],
};

beforeEach(() => {
  identityGetQueryOptionsMock.mockClear();
  useSuspenseQueryMock.mockReset();
});

describe("IdentitySoulCard", () => {
  it("renders indexed Identity & Soul rows when configured", () => {
    useSuspenseQueryMock.mockReturnValue({ data: configuredIdentity });

    render(<IdentitySoulCard slug="acme" />);

    expect(identityGetQueryOptionsMock).toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Identity & Soul" })
    ).toBeVisible();
    expect(screen.getByText("IDENTITY.md")).toBeVisible();
    expect(screen.getByText("SOUL.md")).toBeVisible();
    expect(screen.getByText("Indexed")).toBeVisible();
    expect(screen.getByText("Not indexed")).toBeVisible();
  });

  it("renders the gate state when not configured", () => {
    useSuspenseQueryMock.mockReturnValue({ data: { configured: false } });

    render(<IdentitySoulCard slug="acme" />);

    expect(
      screen.getByRole("heading", { name: "Identity & Soul" })
    ).toBeVisible();
    expect(screen.getAllByText("Not configured")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Set up" })).toBeVisible();
    expect(screen.queryByText("Indexed")).toBeNull();
  });
});
