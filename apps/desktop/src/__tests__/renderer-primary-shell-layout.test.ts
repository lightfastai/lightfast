import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const desktopShell = readFileSync(
  new URL("../renderer/src/react/desktop-shell.tsx", import.meta.url),
  "utf8"
);
const appSidebar = readFileSync(
  new URL("../renderer/src/react/components/app-sidebar.tsx", import.meta.url),
  "utf8"
);
const uiV2Sidebar = readFileSync(
  new URL(
    "../../../../packages/ui-v2/src/components/ui/sidebar.tsx",
    import.meta.url
  ),
  "utf8"
);
const rendererMain = readFileSync(
  new URL("../renderer/src/main.ts", import.meta.url),
  "utf8"
);

describe("primary shell layout", () => {
  it("keeps the content container aligned below the compact header surface", () => {
    expect(rendererMain).toContain("bg-background");
    expect(appSidebar).toContain("@repo/ui-v2/components/ui/sidebar");
    expect(uiV2Sidebar).toContain("bg-sidebar");
    expect(desktopShell).toContain("bg-background");
    expect(desktopShell).toContain('"mt-10 h-[calc(100%_-_40px)]"');
    expect(desktopShell).toContain(
      '"absolute top-0 right-0 left-(--sidebar-width-icon) z-[1] h-10 bg-background"'
    );
    expect(desktopShell).toContain("left-(--sidebar-width-icon)");
    expect(desktopShell).toContain(
      '"box-border flex-1 overflow-auto rounded-tl-xl bg-background p-6 text-muted-foreground"'
    );
    expect(desktopShell).toContain("SidebarInset");
    expect(desktopShell).toContain(
      'className="h-screen flex-1 bg-background p-0"'
    );
  });

  it("pins the renderer root to the viewport so the sidebar reaches the bottom", () => {
    expect(rendererMain).toContain("h-screen overflow-hidden");
    expect(rendererMain).toContain('"relative", "flex", "h-full"');
    expect(appSidebar).toContain('className="h-full min-h-0"');
    expect(appSidebar).toContain("open={false}");
    expect(appSidebar).toContain('collapsible="icon"');
    expect(appSidebar).toContain('className="border-none"');
  });

  it("keeps the content surface free of explicit sidebar/header borders", () => {
    expect(appSidebar).not.toContain("border-r");
    expect(desktopShell).not.toContain("border-r");
    expect(desktopShell).not.toContain("border-b");
    expect(desktopShell).not.toContain("border-t border-l");
    expect(desktopShell).toContain("rounded-tl-xl");
  });
});
