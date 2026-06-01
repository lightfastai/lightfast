import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const importRepositoryMutateMock = vi.fn();
const importRepositoryMutationOptionsMock = vi.fn((options: unknown) => options);
const invalidateQueriesMock = vi.fn();
const setQueryDataMock = vi.fn();
const listRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));

vi.mock("@vendor/clerk", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn((options: unknown) => ({
    isPending: false,
    mutate: importRepositoryMutateMock,
    options,
  })),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
    setQueryData: setQueryDataMock,
  }),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        sourceControl: {
          importRepository: {
            mutationOptions: importRepositoryMutationOptionsMock,
          },
          listRepositories: {
            queryOptions: listRepositoriesQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock("@repo/ui/components/ui/dialog", async () => {
  const React = await import("react");
  const DialogContext = React.createContext<{
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
  } | null>(null);

  return {
    Dialog: ({
      children,
      onOpenChange,
      open,
    }: {
      children?: ReactNode;
      onOpenChange?: (open: boolean) => void;
      open?: boolean;
    }) => (
      <DialogContext.Provider value={{ onOpenChange, open }}>
        {children}
      </DialogContext.Provider>
    ),
    DialogContent: ({ children }: { children?: ReactNode }) => {
      const context = React.useContext(DialogContext);
      if (!context?.open) {
        return null;
      }

      return (
        <div role="dialog">
          {children}
          <button
            onClick={() => context.onOpenChange?.(false)}
            type="button"
          >
            Close
          </button>
        </div>
      );
    },
    DialogDescription: ({ children }: { children?: ReactNode }) => (
      <p>{children}</p>
    ),
    DialogFooter: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    DialogHeader: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    DialogTitle: ({ children }: { children?: ReactNode }) => (
      <h3>{children}</h3>
    ),
    DialogTrigger: ({ children }: { children?: ReactNode }) => {
      const context = React.useContext(DialogContext);
      if (!React.isValidElement(children)) {
        return <>{children}</>;
      }

      const child = children as React.ReactElement<{
        onClick?: React.MouseEventHandler;
      }>;

      return React.cloneElement(child, {
        onClick: (event) => {
          child.props.onClick?.(event);
          context?.onOpenChange?.(true);
        },
      });
    },
  };
});

const { SourceControlConnectionSection } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/source-control-connection-section"
);

const connectedBinding = {
  connectedAt: new Date("2026-05-29T01:02:03.000Z"),
  importedRepositoryCount: 1,
  provider: "github" as const,
  providerLabel: "GitHub",
};

const repositories = {
  binding: connectedBinding,
  organization: {
    id: "987654",
    installationManageUrl:
      "https://github.com/apps/lightfast/installations/1001",
    login: "acme-live",
  },
  repositories: [
    {
      fullName: "acme-live/app",
      id: "101",
      imported: true,
      name: "app",
      owner: { id: "987654", login: "acme-live" },
      private: true,
      watchedPathGlobs: ["**"],
    },
    {
      fullName: "acme-live/docs",
      id: "201",
      imported: false,
      name: "docs",
      owner: { id: "987654", login: "acme-live" },
      private: false,
      watchedPathGlobs: null,
    },
  ],
  repositoriesError: null,
  status: "bound" as const,
};

function renderSection(
  overrides: Partial<Parameters<typeof SourceControlConnectionSection>[0]> = {}
) {
  return render(
    <SourceControlConnectionSection
      connection={connectedBinding}
      orgSlug="acme"
      repositories={repositories}
      {...overrides}
    />
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    has: ({ role }: { role: string }) => role === "org:admin",
    isLoaded: true,
  });
  importRepositoryMutateMock.mockClear();
  importRepositoryMutationOptionsMock.mockClear();
  invalidateQueriesMock.mockClear();
  setQueryDataMock.mockClear();
  listRepositoriesQueryOptionsMock.mockClear();
});

describe("SourceControlConnectionSection", () => {
  it("renders the GitHub integration without personal account state", () => {
    renderSection();

    expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
    expect(screen.getByText("Connected")).toBeVisible();
    expect(screen.getByText("acme-live")).toBeVisible();
    expect(screen.queryByText("Personal GitHub account connected")).toBeNull();
  });

  it("shows imported and unimported repositories with visibility badges", () => {
    renderSection();

    expect(screen.getAllByText("acme-live/app").length).toBeGreaterThan(0);
    expect(screen.getAllByText("acme-live/docs").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Private").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Public").length).toBeGreaterThan(0);
    expect(screen.getByText("1 imported")).toBeVisible();
  });

  it("renders the imported count from the repository response binding when available", () => {
    renderSection({
      repositories: {
        ...repositories,
        binding: {
          ...connectedBinding,
          importedRepositoryCount: 2,
        },
      },
    });

    expect(screen.getByText("2 imported")).toBeVisible();
    expect(screen.queryByText("1 imported")).toBeNull();
  });

  it("does not show the .lightfast repository", () => {
    renderSection({
      repositories: {
        ...repositories,
        repositories: [
          ...repositories.repositories,
          {
            fullName: "acme-live/.lightfast",
            id: "301",
            imported: false,
            name: ".lightfast",
            owner: { id: "987654", login: "acme-live" },
            private: true,
            watchedPathGlobs: null,
          },
        ],
      },
    });

    expect(screen.queryByText("acme-live/.lightfast")).toBeNull();
  });

  it("opens the add repository modal and disables already imported rows", () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /acme-live\/app/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /acme-live\/docs/i })
    ).not.toBeDisabled();
  });

  it("selects an unimported repository and submits the import mutation", () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    fireEvent.click(screen.getByRole("button", { name: /acme-live\/docs/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Add selected repository" })
    );

    expect(importRepositoryMutateMock).toHaveBeenCalledWith({
      repositoryId: "201",
    });
  });

  it("does not keep a selected repository after filtering it out of the modal", () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    fireEvent.click(screen.getByRole("button", { name: /acme-live\/docs/i }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search repositories" }),
      {
        target: { value: "app" },
      }
    );

    expect(
      screen.getByRole("button", { name: "Add selected repository" })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Add selected repository" })
    );
    expect(importRepositoryMutateMock).not.toHaveBeenCalled();
  });

  it("resets modal search and selection after the dialog closes", () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search repositories" }),
      {
        target: { value: "docs" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: /acme-live\/docs/i }));

    expect(
      screen.getByRole("button", { name: "Add selected repository" })
    ).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));

    expect(
      screen.getByRole("textbox", { name: "Search repositories" })
    ).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Add selected repository" })
    ).toBeDisabled();
  });

  it("disables admin actions for non-admin members and hides GitHub access management", () => {
    useAuthMock.mockReturnValue({
      has: () => false,
      isLoaded: true,
    });

    renderSection();

    expect(
      screen.getByRole("button", { name: "Add repository" })
    ).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Manage GitHub access" })
    ).toBeNull();
  });

  it("scopes repository listing errors to the repository area", () => {
    renderSection({
      repositories: {
        ...repositories,
        repositories: [],
        repositoriesError: {
          code: "github_repository_listing_failed",
          message: "GitHub repositories could not be refreshed.",
        },
      },
    });

    expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
    expect(screen.getByText("acme-live")).toBeVisible();
    expect(
      screen.getByText("GitHub repositories could not be refreshed.")
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Add repository" })
    ).toBeDisabled();
  });

  it("renders a degraded state when the live GitHub installation is broken", () => {
    renderSection({
      repositories: {
        ...repositories,
        organization: null,
        repositories: [],
        repositoriesError: {
          code: "github_installation_account_mismatch",
          message:
            "The connected GitHub installation no longer matches this Lightfast organization.",
        },
        status: "broken",
      },
    });

    expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
    expect(screen.queryByText("Connected")).toBeNull();
    expect(screen.queryByText("GitHub organization")).toBeNull();
    expect(screen.getByText("GitHub access needs attention")).toBeVisible();
    expect(
      screen.getByText(
        "The connected GitHub installation no longer matches this Lightfast organization."
      )
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Add repository" })
    ).toBeDisabled();
  });

  it("invalidates the listRepositories query when manually refreshed", () => {
    renderSection();

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh repositories" })
    );

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "sourceControl", "listRepositories"],
    });
  });

  it("shows the setup link when GitHub is not connected", () => {
    renderSection({
      connection: null,
      repositories: {
        binding: null,
        organization: null,
        repositories: [],
        repositoriesError: null,
        status: "unbound",
      },
    });

    expect(screen.getByText("No GitHub organization connected")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open setup" })).toHaveAttribute(
      "href",
      "/acme/tasks/bind"
    );
  });
});
