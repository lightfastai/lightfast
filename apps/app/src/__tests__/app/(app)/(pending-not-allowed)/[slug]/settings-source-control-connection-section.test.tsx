import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const { LightfastRepositorySection, SourceControlConnectionSection } =
  await import(
    "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/source-control-connection-section"
  );

describe("SourceControlConnectionSection", () => {
  it("renders connected GitHub binding details without mutation controls", () => {
    render(
      <SourceControlConnectionSection
        connection={{
          accountLogin: "lightfast-emulated",
          connectedAt: new Date("2026-05-29T01:02:03.000Z"),
          lightfastRepository: null,
          provider: "github",
          providerLabel: "GitHub",
        }}
        orgSlug="acme"
      />
    );

    expect(
      screen.getByRole("heading", { name: "GitHub connection" })
    ).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("lightfast-emulated")).toBeInTheDocument();
    expect(screen.queryByText("Installation ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Connected by")).not.toBeInTheDocument();
    expect(screen.queryByText("1001")).not.toBeInTheDocument();
    expect(screen.queryByText("user_admin")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a read-only empty state in General settings when GitHub is not connected", () => {
    render(<SourceControlConnectionSection connection={null} orgSlug="acme" />);

    expect(screen.getByText("No GitHub organization connected")).toBeVisible();
    expect(
      screen.getByText(
        "Connect GitHub from setup before workspace features can use source-control data."
      )
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Open setup" })).toHaveAttribute(
      "href",
      "/acme/tasks/bind"
    );
  });
});

describe("LightfastRepositorySection", () => {
  it("renders verified .lightfast repository details separately", () => {
    render(
      <LightfastRepositorySection
        connection={{
          accountLogin: "lightfast-emulated",
          connectedAt: new Date("2026-05-29T01:02:03.000Z"),
          lightfastRepository: {
            fullName: "lightfast-emulated/.lightfast",
            id: "987",
            verifiedAt: new Date("2026-05-30T10:00:00.000Z"),
          },
          provider: "github",
          providerLabel: "GitHub",
        }}
        orgSlug="acme"
      />
    );

    expect(
      screen.getByRole("heading", { name: "Lightfast repository" })
    ).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("lightfast-emulated/.lightfast")).toBeVisible();
    expect(screen.getByText("Verified at")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open setup" })).toBeNull();
  });

  it("links to .lightfast setup when GitHub is connected but the repository is not verified", () => {
    render(
      <LightfastRepositorySection
        connection={{
          accountLogin: "lightfast-emulated",
          connectedAt: new Date("2026-05-29T01:02:03.000Z"),
          lightfastRepository: null,
          provider: "github",
          providerLabel: "GitHub",
        }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText(".lightfast is not verified")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open setup" })).toHaveAttribute(
      "href",
      "/acme/tasks/github/lightfast-repo"
    );
  });

  it("links to GitHub setup when no source-control org is connected", () => {
    render(<LightfastRepositorySection connection={null} orgSlug="acme" />);

    expect(screen.getByText("Connect GitHub first")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open setup" })).toHaveAttribute(
      "href",
      "/acme/tasks/bind"
    );
  });
});
