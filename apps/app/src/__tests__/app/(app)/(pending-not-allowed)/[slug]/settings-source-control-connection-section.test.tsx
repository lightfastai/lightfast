import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const { SourceControlConnectionSection } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/source-control-connection-section"
);

describe("SourceControlConnectionSection", () => {
  it("renders connected GitHub binding details without mutation controls", () => {
    render(
      <SourceControlConnectionSection
        connection={{
          connectedAt: new Date("2026-05-29T01:02:03.000Z"),
          connectedByUserId: "user_admin",
          provider: "github",
          providerAccountId: "987654",
          providerAccountLogin: "lightfast-emulated",
          providerInstallationId: "1001",
          status: "active",
        }}
        orgSlug="acme"
      />
    );

    expect(
      screen.getByRole("heading", { name: "GitHub connection" })
    ).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("lightfast-emulated")).toBeInTheDocument();
    expect(screen.getByText("1001")).toBeInTheDocument();
    expect(screen.getByText("user_admin")).toBeInTheDocument();
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
