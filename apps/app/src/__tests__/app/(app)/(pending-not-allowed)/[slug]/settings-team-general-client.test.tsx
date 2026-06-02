import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listUserOrganizationsQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "organization", "listUserOrganizations"],
}));
const sourceControlGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "get"],
}));
const sourceControlListRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));
const identityGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "identity", "get"],
}));
const updateNameMutationOptionsMock = vi.fn((options: unknown) => options);
const useSuspenseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        organization: {
          updateName: {
            mutationOptions: updateNameMutationOptionsMock,
          },
        },
        sourceControl: {
          get: {
            queryOptions: sourceControlGetQueryOptionsMock,
          },
          listRepositories: {
            queryOptions: sourceControlListRepositoriesQueryOptionsMock,
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
  useSuspenseQuery: useSuspenseQueryMock,
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

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/source-control-connection-section",
  () => ({
    LightfastRepositorySection: ({
      connection,
      orgSlug,
    }: {
      connection: { accountLogin: string | null } | null;
      orgSlug: string;
    }) => (
      <div data-testid="lightfast-repository-section">
        {orgSlug}:{connection?.accountLogin ?? "unbound"}
      </div>
    ),
    SourceControlConnectionSection: ({
      connection,
      repositories,
      orgSlug,
    }: {
      connection: { importedRepositoryCount: number } | null;
      repositories: { organization: { login: string } | null };
      orgSlug: string;
    }) => (
      <div data-testid="source-control-section">
        {orgSlug}:{connection?.importedRepositoryCount ?? "unbound"}:
        {repositories.organization?.login ?? "no-org"}
      </div>
    ),
  })
);

const { TeamGeneralSettingsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client"
);

beforeEach(() => {
  listUserOrganizationsQueryOptionsMock.mockClear();
  sourceControlGetQueryOptionsMock.mockClear();
  sourceControlListRepositoriesQueryOptionsMock.mockClear();
  identityGetQueryOptionsMock.mockClear();
  updateNameMutationOptionsMock.mockClear();
  useSuspenseQueryMock.mockReset();
  useSuspenseQueryMock.mockImplementation(
    (options: { queryKey: readonly unknown[] }) => {
      if (options.queryKey[0] === "viewer") {
        return {
          data: [{ initials: "AI", slug: "acme" }],
        };
      }

      if (options.queryKey.includes("listRepositories")) {
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
            organization: {
              id: "987654",
              installationManageUrl:
                "https://github.com/apps/lightfast/installations/1001",
              login: "acme-live",
            },
            lightfastRepository: null,
            repositories: [],
            repositoriesError: null,
            status: "bound",
          },
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
  it("loads and renders read-only source-control sections on General settings", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(sourceControlGetQueryOptionsMock).toHaveBeenCalled();
    expect(sourceControlListRepositoriesQueryOptionsMock).toHaveBeenCalled();
    expect(identityGetQueryOptionsMock).toHaveBeenCalled();
    expect(screen.getByTestId("source-control-section")).toHaveTextContent(
      "acme:2:acme-live"
    );
    expect(
      screen.getByTestId("lightfast-repository-section")
    ).toHaveTextContent("acme:lightfast-emulated");
    expect(screen.getByRole("heading", { name: "Identity" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Soul" })).toBeVisible();
    expect(screen.getByText("IDENTITY.md")).toBeVisible();
    expect(screen.getByText("SOUL.md is missing")).toBeVisible();
  });
});
