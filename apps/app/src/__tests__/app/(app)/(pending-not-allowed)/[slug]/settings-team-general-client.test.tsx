import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listUserOrganizationsQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "organization", "listUserOrganizations"],
}));
const identityGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "identity", "get"],
}));
const updateNameMutationOptionsMock = vi.fn((options: unknown) => options);
const useQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        organization: {
          updateName: {
            mutationOptions: updateNameMutationOptionsMock,
          },
        },
        identity: {
          get: {
            queryOptions: identityGetQueryOptionsMock,
          },
        },
      },
    },
    viewer: {
      organization: {
        listUserOrganizations: {
          queryOptions: listUserOrganizationsQueryOptionsMock,
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useQueryClient: () => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
  useQuery: useQueryMock,
  useSuspenseQuery: vi.fn(() => ({
    data: [{ initials: "AI", slug: "acme" }],
  })),
}));

vi.mock("@vendor/clerk", () => ({
  useOrganizationList: () => ({
    setActive: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const { TeamGeneralSettingsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client"
);

// .lightfast configured: IDENTITY.md indexed, SOUL.md not indexed.
const indexedIdentity = {
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
  listUserOrganizationsQueryOptionsMock.mockClear();
  identityGetQueryOptionsMock.mockClear();
  updateNameMutationOptionsMock.mockClear();
  useQueryMock.mockReset();
  useQueryMock.mockImplementation(() => ({ data: indexedIdentity }));
});

describe("TeamGeneralSettingsClient", () => {
  it("renders the reworked Profile group", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(screen.getByRole("heading", { name: "Profile" })).toBeVisible();
    expect(screen.getByText("Avatar")).toBeVisible();
    expect(screen.getByText("Team name")).toBeVisible();
    expect(screen.getByLabelText("Team name")).toHaveValue("acme");
  });

  it("loads and renders Identity & Soul on General settings", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(identityGetQueryOptionsMock).toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Identity & Soul" })
    ).toBeVisible();
    expect(screen.getByText("IDENTITY.md")).toBeVisible();
    expect(screen.getByText("SOUL.md")).toBeVisible();
    expect(screen.getByText("Indexed")).toBeVisible();
    expect(screen.getByText("Not indexed")).toBeVisible();
  });

  it("renders the gate state when identity settings are unconfigured", () => {
    useQueryMock.mockImplementation(() => ({
      data: undefined,
      error: { data: { code: "PRECONDITION_FAILED" } },
      isError: true,
    }));

    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(
      screen.getByRole("heading", { name: "Identity & Soul" })
    ).toBeVisible();
    expect(screen.getAllByText("Not configured")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Set up" })).toBeVisible();
    expect(screen.queryByText("Indexed")).toBeNull();
  });
});
