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
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    disabled,
  }: {
    children?: ReactNode;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} type="button">
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const { OrganizationCard } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/organization-card"
);

const connection = {
  accountLogin: "acme-live",
  connectedAt: new Date("2026-05-29T01:02:03.000Z"),
  importedRepositoryCount: 1,
  lightfastRepository: {
    fullName: "acme-live/.lightfast",
    id: "301",
    verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
  },
  provider: "github" as const,
  providerLabel: "GitHub",
};

describe("OrganizationCard", () => {
  it("shows the connected org login and a connected-on subtitle", () => {
    render(<OrganizationCard connection={connection} />);

    expect(screen.getByText("acme-live")).toBeVisible();
    expect(screen.getByText(/^Connected on /)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Connected/ })
    ).toBeInTheDocument();
  });

  it("renders disabled Configure and Disconnect actions with an explanatory tooltip", () => {
    render(<OrganizationCard connection={connection} />);

    expect(
      screen.getByRole("button", { name: "Configure in GitHub" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeDisabled();
    expect(
      screen.getByText("Connection is set up once and can't be disconnected.")
    ).toBeInTheDocument();
  });

  it("falls back to a placeholder when the account login is missing", () => {
    render(
      <OrganizationCard connection={{ ...connection, accountLogin: null }} />
    );

    expect(screen.getByText("Not available")).toBeVisible();
  });
});
