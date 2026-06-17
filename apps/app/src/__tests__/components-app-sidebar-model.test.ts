import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getWorkspaceNavSections,
  isWorkspacePathActive,
} from "~/components/app-sidebar-model";
import { usesRouteOwnedAuthenticatedShell } from "~/components/authenticated-layout-model";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("workspace sidebar model", () => {
  it("builds the workspace navigation groups from the active slug", () => {
    const sections = getWorkspaceNavSections("acme").map((section) => ({
      label: section.label,
      items: section.items.map(({ href, title }) => ({ href, title })),
    }));

    expect(sections).toEqual([
      {
        items: [
          { href: "/acme/automations", title: "Automations" },
          { href: "/acme/connectors", title: "Connectors" },
          {
            href: "/acme/developer-connections",
            title: "Developer Connections",
          },
          { href: "/acme/skills", title: "Skills" },
          { href: "/acme/decisions", title: "Decisions" },
        ],
      },
      {
        label: "Workspace",
        items: [
          { href: "/acme/signals", title: "Signals" },
          { href: "/acme/people", title: "People" },
        ],
      },
      {
        label: "Manage",
        items: [{ href: "/acme/settings", title: "Settings" }],
      },
    ]);
  });

  it("matches nested workspace paths as active", () => {
    expect(isWorkspacePathActive("/acme/signals", "/acme/signals")).toBe(true);
    expect(isWorkspacePathActive("/acme/signals", "/acme/signals/123")).toBe(
      true
    );
    expect(isWorkspacePathActive("/acme/signals", "/acme/people")).toBe(false);
  });

  it("lets workspace routes own their shell while account routes use the basic shell", () => {
    expect(usesRouteOwnedAuthenticatedShell("/acme")).toBe(true);
    expect(usesRouteOwnedAuthenticatedShell("/acme/signals")).toBe(true);
    expect(usesRouteOwnedAuthenticatedShell("/account/settings/general")).toBe(
      false
    );
    expect(usesRouteOwnedAuthenticatedShell("/accounts/teams/new")).toBe(false);
    expect(usesRouteOwnedAuthenticatedShell("/sign-in")).toBe(false);
  });

  it("uses Hugeicons for app-sidebar glyphs", () => {
    const sidebarSource = source("src/components/app-sidebar.tsx");

    expect(sidebarSource).toContain('from "@hugeicons/core-free-icons"');
    expect(sidebarSource).toContain('from "@hugeicons/react"');
    expect(sidebarSource).not.toContain('from "lucide-react"');
    expect(sidebarSource).toContain("HugeiconsIcon");
    expect(sidebarSource).toContain("navIcons");
  });
});
