import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const { SourceControlSection } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/source-control-connection-section"
);

const connectedAt = new Date("2026-05-29T01:02:03.000Z");
const verifiedAt = new Date("2026-05-30T10:00:00.000Z");

describe("SourceControlSection", () => {
  it("renders connected GitHub and verified repository as read-only status rows", () => {
    render(
      <SourceControlSection
        connection={{
          accountLogin: "lightfast-emulated",
          connectedAt,
          lightfastRepository: {
            fullName: "lightfast-emulated/.lightfast",
            id: "987",
            verifiedAt,
          },
          provider: "github",
          providerLabel: "GitHub",
        }}
        orgSlug="acme"
      />
    );

    expect(
      screen.getByRole("heading", { name: "Source control" })
    ).toBeInTheDocument();
    expect(screen.getByText("GitHub connection")).toBeVisible();
    expect(screen.getByText("Lightfast repository")).toBeVisible();
    expect(screen.getByText("Connected")).toBeVisible();
    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.getByText("lightfast-emulated")).toBeVisible();
    expect(screen.getByText("lightfast-emulated/.lightfast")).toBeVisible();
    // Read-only: no setup links and no mutation controls when fully connected.
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("links to repository setup when GitHub is connected but the repo is not verified", () => {
    render(
      <SourceControlSection
        connection={{
          accountLogin: "lightfast-emulated",
          connectedAt,
          lightfastRepository: null,
          provider: "github",
          providerLabel: "GitHub",
        }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("Connected")).toBeVisible();
    expect(screen.getByText("lightfast-emulated")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open setup" })).toHaveAttribute(
      "href",
      "/acme/tasks/github/lightfast-repo"
    );
  });

  it("renders empty states linking to setup when nothing is connected", () => {
    render(<SourceControlSection connection={null} orgSlug="acme" />);

    expect(
      screen.getByText(
        "Connect GitHub from setup before workspace features can use source-control data."
      )
    ).toBeVisible();
    expect(screen.queryByText("Connected")).toBeNull();
    expect(screen.queryByText("Verified")).toBeNull();
    expect(screen.getByRole("link", { name: "Open setup" })).toHaveAttribute(
      "href",
      "/acme/tasks/bind"
    );
    expect(
      screen.getByRole("link", { name: "Connect GitHub" })
    ).toHaveAttribute("href", "/acme/tasks/bind");
  });

  it("omits the status subtitle when a timestamp is invalid", () => {
    render(
      <SourceControlSection
        connection={{
          accountLogin: "lightfast-emulated",
          connectedAt: new Date(Number.NaN),
          lightfastRepository: {
            fullName: "lightfast-emulated/.lightfast",
            id: "987",
            verifiedAt: new Date(Number.NaN),
          },
          provider: "github",
          providerLabel: "GitHub",
        }}
        orgSlug="acme"
      />
    );

    // Rows + badges still render; only the "Connected/Verified <date>" subtitle is dropped.
    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.getByText("lightfast-emulated/.lightfast")).toBeVisible();
    expect(screen.queryByText(/^Connected /)).toBeNull();
    expect(screen.queryByText(/^Verified /)).toBeNull();
  });
});
