import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const importRepositoryMutateMock = vi.fn();
const importRepositoryMutationOptionsMock = vi.fn(
  (options: unknown) => options
);
const setQueryDataMock = vi.fn();
const listRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn((options: unknown) => ({
    isPending: false,
    mutate: importRepositoryMutateMock,
    options,
  })),
  useQueryClient: () => ({
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
          <button onClick={() => context.onOpenChange?.(false)} type="button">
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

const { AddRepositoryDialog } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/add-repository-dialog"
);

const repositories = [
  {
    fullName: "acme-live/app",
    id: "101",
    imported: true,
    name: "app",
    owner: { id: "987654", login: "acme-live" },
    private: true,
    syncStatus: "disabled" as const,
    watchedPathGlobs: ["**"],
    webUrl: "https://github.lightfast.localhost/acme-live/app",
  },
  {
    fullName: "acme-live/docs",
    id: "201",
    imported: false,
    name: "docs",
    owner: { id: "987654", login: "acme-live" },
    private: false,
    syncStatus: "disabled" as const,
    watchedPathGlobs: null,
    webUrl: "https://github.lightfast.localhost/acme-live/docs",
  },
];

function renderDialog(disabled = false) {
  return render(
    <AddRepositoryDialog disabled={disabled} repositories={repositories} />
  );
}

beforeEach(() => {
  importRepositoryMutateMock.mockClear();
  importRepositoryMutationOptionsMock.mockClear();
  setQueryDataMock.mockClear();
  listRepositoriesQueryOptionsMock.mockClear();
});

describe("AddRepositoryDialog", () => {
  it("disables the trigger when the parent says so", () => {
    renderDialog(true);
    expect(
      screen.getByRole("button", { name: "Add repository" })
    ).toBeDisabled();
  });

  it("opens the dialog and disables already-added rows", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /acme-live\/app/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /acme-live\/docs/i })
    ).not.toBeDisabled();
  });

  it("excludes the .lightfast repository from the picker", () => {
    render(
      <AddRepositoryDialog
        disabled={false}
        repositories={[
          ...repositories,
          {
            fullName: "acme-live/.lightfast",
            id: "301",
            imported: false,
            name: ".lightfast",
            owner: { id: "987654", login: "acme-live" },
            private: true,
            syncStatus: "disabled" as const,
            watchedPathGlobs: null,
            webUrl: "https://github.lightfast.localhost/acme-live/.lightfast",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    expect(
      screen.queryByRole("button", { name: /acme-live\/\.lightfast/i })
    ).toBeNull();
  });

  it("selects an available repository and submits the import mutation", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    fireEvent.click(screen.getByRole("button", { name: /acme-live\/docs/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Add selected repository" })
    );

    expect(importRepositoryMutateMock).toHaveBeenCalledWith({
      repositoryId: "201",
    });
  });

  it("drops a selection that is filtered out before submit", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    fireEvent.click(screen.getByRole("button", { name: /acme-live\/docs/i }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search repositories" }),
      { target: { value: "app" } }
    );

    expect(
      screen.getByRole("button", { name: "Add selected repository" })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Add selected repository" })
    );
    expect(importRepositoryMutateMock).not.toHaveBeenCalled();
  });

  it("resets search and selection after the dialog closes", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search repositories" }),
      { target: { value: "docs" } }
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
});
