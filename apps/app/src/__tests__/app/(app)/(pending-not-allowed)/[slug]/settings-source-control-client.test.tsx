import type { AppRouterOutputs } from "@api/app";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type SourceControlRepositories =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["listRepositories"];

const sourceControlGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "get"],
}));
const sourceControlListRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));
const useSuspenseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        sourceControl: {
          get: { queryOptions: sourceControlGetQueryOptionsMock },
          listRepositories: {
            queryOptions: sourceControlListRepositoriesQueryOptionsMock,
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
  default: ({
    children,
    href,
  }: {
    children?: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-connection-card",
  () => ({
    SourceControlConnectionCard: ({
      connection,
      orgSlug,
    }: {
      connection: { accountLogin: string };
      orgSlug: string;
    }) => (
      <div data-testid="connection-card">
        {connection.accountLogin}:{orgSlug}
      </div>
    ),
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-list",
  () => ({
    RepositoryList: ({
      repositories,
    }: {
      repositories: { organization: { login: string } | null };
    }) => (
      <div data-testid="repository-list">
        {repositories.organization?.login ?? "no-org"}
      </div>
    ),
  })
);

const { SourceControlSettingsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-settings-client"
);

const boundBinding = {
  accountLogin: "acme-live",
  connectedAt: new Date("2026-05-29T01:02:03.000Z"),
  importedRepositoryCount: 2,
  lightfastRepository: null,
  newLightfastRepositoryUrl:
    "https://github.com/new?name=.lightfast&owner=acme-live",
  provider: "github" as const,
  providerLabel: "GitHub",
};

const boundRepositories: SourceControlRepositories = {
  binding: boundBinding,
  lightfastRepository: null,
  organization: {
    id: "987654",
    installationManageUrl:
      "https://github.com/apps/lightfast/installations/1001",
    login: "acme-live",
  },
  repositories: [],
  repositoriesError: null,
  status: "bound" as const,
};

function mockQueries(options: {
  binding: typeof boundBinding | null;
  repositories: typeof boundRepositories;
}) {
  useSuspenseQueryMock.mockImplementation(
    (queryOptions: { queryKey: readonly unknown[] }) => {
      if (queryOptions.queryKey.includes("listRepositories")) {
        return { data: options.repositories };
      }
      return { data: { binding: options.binding, status: "bound" } };
    }
  );
}

beforeEach(() => {
  sourceControlGetQueryOptionsMock.mockClear();
  sourceControlListRepositoriesQueryOptionsMock.mockClear();
  useSuspenseQueryMock.mockReset();
});

describe("SourceControlSettingsClient", () => {
  it("renders the connection card and repository list when bound", () => {
    mockQueries({ binding: boundBinding, repositories: boundRepositories });
    render(<SourceControlSettingsClient slug="acme" />);

    expect(sourceControlGetQueryOptionsMock).toHaveBeenCalled();
    expect(sourceControlListRepositoriesQueryOptionsMock).toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Source Control & Git" })
    ).toBeVisible();
    expect(screen.getByTestId("connection-card")).toHaveTextContent(
      "acme-live:acme"
    );
    expect(screen.getByTestId("repository-list")).toHaveTextContent(
      "acme-live"
    );
  });

  it("renders only the empty state when unbound", () => {
    mockQueries({
      binding: null,
      repositories: {
        binding: null,
        lightfastRepository: null,
        organization: null,
        repositories: [],
        repositoriesError: null,
        status: "unbound",
      },
    });
    render(<SourceControlSettingsClient slug="acme" />);

    expect(screen.getByText("No GitHub organization connected")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open setup" })).toHaveAttribute(
      "href",
      "/acme/tasks/bind"
    );
    expect(screen.queryByTestId("connection-card")).toBeNull();
    expect(screen.queryByTestId("repository-list")).toBeNull();
  });
});
