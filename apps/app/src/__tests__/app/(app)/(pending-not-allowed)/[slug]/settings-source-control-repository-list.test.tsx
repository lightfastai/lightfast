import type { AppRouterOutputs } from "@api/app";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type SourceControlRepositories =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["listRepositories"];

const useAuthMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const listRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));

vi.mock("@vendor/clerk", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        sourceControl: {
          listRepositories: {
            queryOptions: listRepositoriesQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-card",
  () => ({
    RepositoryCard: ({ repository }: { repository: { fullName: string } }) => (
      <div data-testid="repository-card">{repository.fullName}</div>
    ),
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/add-repository-dialog",
  () => ({
    AddRepositoryDialog: ({ disabled }: { disabled: boolean }) => (
      <div data-disabled={String(disabled)} data-testid="add-repository-dialog">
        Add repository
      </div>
    ),
  })
);

const { RepositoryList } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-list"
);

const importedRepo = {
  fullName: "acme-live/app",
  id: "101",
  imported: true,
  name: "app",
  owner: { id: "987654", login: "acme-live" },
  private: true,
  syncStatus: "disabled" as const,
  watchedPathGlobs: ["**"],
};
const availableRepo = {
  fullName: "acme-live/docs",
  id: "201",
  imported: false,
  name: "docs",
  owner: { id: "987654", login: "acme-live" },
  private: false,
  syncStatus: "disabled" as const,
  watchedPathGlobs: null,
};

const baseRepositories = {
  binding: {
    accountLogin: "acme-live",
    connectedAt: new Date("2026-05-29T01:02:03.000Z"),
    importedRepositoryCount: 1,
    lightfastRepository: null,
    provider: "github" as const,
    providerLabel: "GitHub",
  },
  lightfastRepository: null,
  organization: {
    id: "987654",
    installationManageUrl:
      "https://github.com/apps/lightfast/installations/1001",
    login: "acme-live",
  } as { id: string; installationManageUrl: string; login: string } | null,
  repositories: [importedRepo, availableRepo],
  repositoriesError: null as { code: string; message: string } | null,
  status: "bound" as "bound" | "unbound",
};

function renderList(overrides: Partial<typeof baseRepositories> = {}) {
  return render(
    <RepositoryList
      repositories={
        {
          ...baseRepositories,
          ...overrides,
        } as unknown as SourceControlRepositories
      }
    />
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    has: ({ role }: { role: string }) => role === "org:admin",
    isLoaded: true,
  });
  invalidateQueriesMock.mockClear();
  listRepositoriesQueryOptionsMock.mockClear();
});

describe("RepositoryList", () => {
  it("renders the section header, refresh and add controls", () => {
    renderList();

    expect(screen.getByRole("heading", { name: "Repositories" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Refresh repositories" })
    ).toBeVisible();
    expect(screen.getByTestId("add-repository-dialog")).toBeVisible();
  });

  it("renders a card only for imported repositories", () => {
    renderList();

    const cards = screen.getAllByTestId("repository-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("acme-live/app");
  });

  it("shows the empty prompt when no repositories are imported", () => {
    renderList({ repositories: [availableRepo] });

    expect(screen.queryByTestId("repository-card")).toBeNull();
    expect(screen.getByText(/No repositories added yet\./)).toBeVisible();
  });

  it("shows the listing error in place of the cards", () => {
    renderList({
      repositories: [],
      repositoriesError: {
        code: "github_repository_listing_failed",
        message: "GitHub repositories could not be refreshed.",
      },
    });

    expect(
      screen.getByText("GitHub repositories could not be refreshed.")
    ).toBeVisible();
    expect(screen.queryByTestId("repository-card")).toBeNull();
  });

  it("invalidates the repository query when refreshed", () => {
    renderList();

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh repositories" })
    );
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "sourceControl", "listRepositories"],
    });
  });

  it("disables adding for non-admins", () => {
    useAuthMock.mockReturnValue({ has: () => false, isLoaded: true });
    renderList();

    expect(screen.getByTestId("add-repository-dialog")).toHaveAttribute(
      "data-disabled",
      "true"
    );
  });

  it("disables adding when the repository listing failed", () => {
    renderList({
      repositories: [importedRepo],
      repositoriesError: {
        code: "github_repository_listing_failed",
        message: "GitHub repositories could not be refreshed.",
      },
    });

    expect(screen.getByTestId("add-repository-dialog")).toHaveAttribute(
      "data-disabled",
      "true"
    );
  });
});
