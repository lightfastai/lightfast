import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children?: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const { LightfastRepositoryCard } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/lightfast-repository-card"
);

const baseConnection = {
  accountLogin: "acme-live",
  connectedAt: new Date("2026-05-29T01:02:03.000Z"),
  importedRepositoryCount: 1,
  provider: "github" as const,
  providerLabel: "GitHub",
};

describe("LightfastRepositoryCard", () => {
  it("renders the verified repository with a Verified badge and date", () => {
    render(
      <LightfastRepositoryCard
        connection={{
          ...baseConnection,
          lightfastRepository: {
            fullName: "acme-live/.lightfast",
            id: "301",
            verifiedAt: new Date("2026-05-30T10:00:00.000Z"),
          },
        }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("acme-live/.lightfast")).toBeVisible();
    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.getByText(/^Verified /)).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to repo setup when the repository is not yet verified", () => {
    render(
      <LightfastRepositoryCard
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
      <LightfastRepositoryCard
        connection={{
          ...baseConnection,
          lightfastRepository: {
            fullName: "acme-live/.lightfast",
            id: "301",
            verifiedAt: new Date(Number.NaN),
          },
        }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.queryByText(/^Verified /)).toBeNull();
    expect(
      screen.getByText(
        "The repository Lightfast uses to coordinate workspace automation."
      )
    ).toBeVisible();
  });
});
