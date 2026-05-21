import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsSidebar } from "~/components/settings-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/account/settings/general",
}));

describe("SettingsSidebar", () => {
  it("keeps nav rows in their normal position so titles can align to link text", () => {
    render(
      <SettingsSidebar
        basePath="/account/settings"
        items={[{ name: "General", path: "general" }]}
      />
    );

    const link = screen.getByRole("link", { name: "General" });
    const nav = link.closest("nav");

    expect(link).toHaveClass("px-3");
    expect(nav).not.toHaveClass("-ml-3", "w-[calc(100%+0.75rem)]");
  });
});
