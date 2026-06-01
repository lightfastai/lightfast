import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/ui/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const { RepositoryCard } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-card"
);

const baseRepository = {
  fullName: "acme-live/web",
  id: "101",
  imported: true,
  name: "web",
  owner: { id: "987654", login: "acme-live" },
  private: true,
  syncStatus: "disabled" as const,
  watchedPathGlobs: null,
};

describe("RepositoryCard", () => {
  it("renders the repository name, visibility, sync status and GitHub link", () => {
    render(<RepositoryCard repository={baseRepository} />);

    expect(screen.getByText("acme-live/web")).toBeVisible();
    expect(screen.getByText("Private")).toBeVisible();
    expect(screen.getByText("Not syncing")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open on GitHub" })
    ).toHaveAttribute("href", "https://github.com/acme-live/web");
  });

  it("shows the syncing label for enabled repositories", () => {
    render(
      <RepositoryCard
        repository={{ ...baseRepository, syncStatus: "enabled" }}
      />
    );

    expect(screen.getByText("Syncing")).toBeVisible();
  });

  it("reveals the empty watched-paths message when expanded", () => {
    render(<RepositoryCard repository={baseRepository} />);

    expect(screen.queryByText("No watched paths configured")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Watched paths" }));
    expect(screen.getByText("No watched paths configured")).toBeVisible();
  });

  it("describes the all-paths glob in human terms", () => {
    render(
      <RepositoryCard
        repository={{ ...baseRepository, watchedPathGlobs: ["**"] }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Watched paths" }));
    expect(screen.getByText("Watching all paths")).toBeVisible();
  });

  it("lists each specific watched glob as a chip", () => {
    render(
      <RepositoryCard
        repository={{
          ...baseRepository,
          watchedPathGlobs: ["apps/**", "packages/**"],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Watched paths" }));
    expect(screen.getByText("apps/**")).toBeVisible();
    expect(screen.getByText("packages/**")).toBeVisible();
  });
});
