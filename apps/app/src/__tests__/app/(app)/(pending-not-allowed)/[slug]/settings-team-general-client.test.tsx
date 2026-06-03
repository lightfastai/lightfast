import { render, screen } from "@testing-library/react";
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
  useSuspenseQuery: vi.fn((_options: { queryKey: readonly unknown[] }) => ({
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

const { TeamGeneralSettingsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client"
);

beforeEach(() => {
  listUserOrganizationsQueryOptionsMock.mockClear();
  identityGetQueryOptionsMock.mockClear();
  updateNameMutationOptionsMock.mockClear();
  useQueryMock.mockReset();
  useQueryMock.mockImplementation(
    (options: { queryKey: readonly unknown[] }) => {
      if (options.queryKey[0] === "viewer") {
        return {
          data: [{ initials: "AI", slug: "acme" }],
        };
      }

      if (options.queryKey.includes("identity")) {
        return {
          data: {
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
                indexedCommitSha: "commit-main",
                kind: "soul",
                label: "Soul",
                path: "SOUL.md",
                size: null,
                sourceMarkdown: null,
                status: "missing",
              },
            ],
          },
        };
      }

      return {
        data: {
          binding: {
            accountLogin: "lightfast-emulated",
            connectedAt: new Date("2026-05-29T01:02:03.000Z"),
            importedRepositoryCount: 2,
            lightfastRepository: {
              fullName: "lightfast-emulated/.lightfast",
              id: "repo_lightfast",
              verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
            },
            provider: "github",
            providerLabel: "GitHub",
          },
          status: "bound",
        },
      };
    }
  );
});

describe("TeamGeneralSettingsClient", () => {
  it("loads and renders identity settings on General settings", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(identityGetQueryOptionsMock).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Identity" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Soul" })).toBeVisible();
    expect(screen.getByText("IDENTITY.md")).toBeVisible();
    expect(screen.getByText("SOUL.md is missing")).toBeVisible();
  });

  it("renders a placeholder when identity settings are unconfigured", () => {
    useQueryMock.mockImplementation(
      (options: { queryKey: readonly unknown[] }) => {
        if (options.queryKey.includes("identity")) {
          return {
            data: undefined,
            error: { data: { code: "PRECONDITION_FAILED" } },
            isError: true,
          };
        }

        return {
          data: {
            binding: {
              accountLogin: "lightfast-emulated",
              connectedAt: new Date("2026-05-29T01:02:03.000Z"),
              importedRepositoryCount: 2,
              lightfastRepository: {
                fullName: "lightfast-emulated/.lightfast",
                id: "repo_lightfast",
                verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
              },
              provider: "github",
              providerLabel: "GitHub",
            },
            status: "bound",
          },
        };
      }
    );

    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(
      screen.getByText("Identity repository is not configured.")
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Identity" })).toBeNull();
  });
});
