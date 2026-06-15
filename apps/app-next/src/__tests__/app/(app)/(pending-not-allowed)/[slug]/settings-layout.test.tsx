import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SettingsLayout from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/layout";

vi.mock("next/navigation", () => ({
  usePathname: () => "/acme/settings",
}));

describe("settings layout", () => {
  it("aligns the Settings title with the sidebar label rhythm", async () => {
    render(
      await SettingsLayout({
        children: <div>Settings page</div>,
        params: Promise.resolve({ slug: "acme" }),
      })
    );

    const heading = screen.getByRole("heading", { name: "Settings" });

    expect(heading).toHaveClass("pl-3");
    expect(heading.parentElement).toHaveClass("pt-2");
    expect(heading.parentElement).toHaveClass("pb-8");
  });

  it("includes general, members, billing, and API key navigation", async () => {
    render(
      await SettingsLayout({
        children: <div>Settings page</div>,
        params: Promise.resolve({ slug: "acme" }),
      })
    );

    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute(
      "href",
      "/acme/settings"
    );
    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute(
      "href",
      "/acme/settings/members"
    );
    expect(screen.getByRole("link", { name: "Billing" })).toHaveAttribute(
      "href",
      "/acme/settings/billing"
    );
    expect(screen.getByRole("link", { name: "API Keys" })).toHaveAttribute(
      "href",
      "/acme/settings/api-keys"
    );
  });
});
