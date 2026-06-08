import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/ui/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="connection-status-menu">
      {children}
    </div>
  ),
  DropdownMenuItem: ({
    children,
    className,
    disabled,
  }: {
    children?: ReactNode;
    className?: string;
    disabled?: boolean;
  }) => (
    <button className={className} disabled={disabled} type="button">
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const { SourceControlConnectionCard } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-connection-card"
);

const baseConnection = {
  accountLogin: "acme-live",
  connectedAt: new Date("2026-05-29T01:02:03.000Z"),
  importedRepositoryCount: 1,
  newLightfastRepositoryUrl:
    "https://github.com/new?name=.lightfast&owner=acme-live",
  provider: "github" as const,
  providerLabel: "GitHub",
};

const verifiedRepository = {
  fullName: "acme-live/.lightfast",
  id: "301",
  verifiedAt: new Date("2026-05-30T10:00:00.000Z"),
};

describe("SourceControlConnectionCard", () => {
  it("shows the connected org login and a connected-on subtitle", () => {
    render(
      <SourceControlConnectionCard
        connection={{
          ...baseConnection,
          lightfastRepository: verifiedRepository,
        }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("acme-live")).toBeVisible();
    expect(screen.getByText(/^Connected on /)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Connection status" })
    ).toHaveTextContent("Connected");
  });

  it("uses the lf select trigger and dropdown styling for connection status", () => {
    render(
      <SourceControlConnectionCard
        connection={{
          ...baseConnection,
          lightfastRepository: verifiedRepository,
        }}
        orgSlug="acme"
      />
    );

    expect(
      screen.getByRole("button", { name: "Connection status" })
    ).toHaveClass(
      "justify-between",
      "border-input",
      "bg-card",
      "px-2.5",
      "font-normal",
      "hover:bg-accent"
    );
    expect(screen.getByTestId("connection-status-menu")).toHaveClass(
      "min-w-[var(--radix-dropdown-menu-trigger-width)]"
    );
  });

  it("uses lf select item styling for immutable dropdown actions", () => {
    render(
      <SourceControlConnectionCard
        connection={{
          ...baseConnection,
          lightfastRepository: verifiedRepository,
        }}
        orgSlug="acme"
      />
    );

    expect(
      screen.getByRole("button", { name: "Configure in GitHub" })
    ).toHaveClass("gap-2");
    expect(screen.getByText("Configure in GitHub")).toHaveClass(
      "min-w-0",
      "flex-1",
      "truncate"
    );
    expect(screen.getByRole("button", { name: "Disconnect" })).toHaveClass(
      "gap-2"
    );
    expect(screen.getByText("Disconnect")).toHaveClass(
      "min-w-0",
      "flex-1",
      "truncate"
    );
  });

  it("shows disabled immutable connection actions with the setup tooltip", () => {
    render(
      <SourceControlConnectionCard
        connection={{
          ...baseConnection,
          lightfastRepository: verifiedRepository,
        }}
        orgSlug="acme"
      />
    );

    expect(
      screen.getByRole("button", { name: "Configure in GitHub" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeDisabled();
    expect(
      screen.getAllByText(
        "Connection is set up once and can't be disconnected."
      )
    ).toHaveLength(2);
  });

  it("falls back to a placeholder when the account login is missing", () => {
    render(
      <SourceControlConnectionCard
        connection={{
          ...baseConnection,
          accountLogin: "",
          lightfastRepository: verifiedRepository,
        }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("Not available")).toBeVisible();
  });

  it("renders the verified .lightfast repository with a Verified badge and date", () => {
    render(
      <SourceControlConnectionCard
        connection={{
          ...baseConnection,
          lightfastRepository: verifiedRepository,
        }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("acme-live/.lightfast")).toBeVisible();
    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.getByText(/^Verified /)).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to repo setup when the .lightfast repository is not yet verified", () => {
    render(
      <SourceControlConnectionCard
        connection={{ ...baseConnection, lightfastRepository: null }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("acme-live/.lightfast")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open setup" })).toHaveAttribute(
      "href",
      "/acme/tasks/github/lightfast-repo"
    );
  });

  it("keeps the Verified badge but drops the subtitle for an invalid date", () => {
    render(
      <SourceControlConnectionCard
        connection={{
          ...baseConnection,
          lightfastRepository: {
            ...verifiedRepository,
            verifiedAt: new Date(Number.NaN),
          },
        }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.queryByText(/^Verified /)).toBeNull();
    expect(screen.getByText("Coordinates workspace automation.")).toBeVisible();
  });
});
