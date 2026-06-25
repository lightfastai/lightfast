import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(
  new URL("../renderer/index.html", import.meta.url),
  "utf8"
);
const desktopShell = readFileSync(
  new URL("../renderer/src/react/desktop-shell.tsx", import.meta.url),
  "utf8"
);
const appSidebar = readFileSync(
  new URL("../renderer/src/react/components/app-sidebar.tsx", import.meta.url),
  "utf8"
);
const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const uiV2PackageJson = JSON.parse(
  readFileSync(
    new URL("../../../../packages/ui-v2/package.json", import.meta.url),
    "utf8"
  )
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const sourceFiles = readFileSync(
  new URL("../renderer/src/react/components/app-sidebar.tsx", import.meta.url),
  "utf8"
);
const localSidebar = readFileSync(
  new URL(
    "../../../../packages/ui-v2/src/components/ui/sidebar.tsx",
    import.meta.url
  ),
  "utf8"
);
const componentsJson = readFileSync(
  new URL("../../../../packages/ui-v2/components.json", import.meta.url),
  "utf8"
);
const localButton = readFileSync(
  new URL(
    "../../../../packages/ui-v2/src/components/ui/button.tsx",
    import.meta.url
  ),
  "utf8"
);

describe("primary objective sidebar", () => {
  it("keeps index.html as only the app mount and module entry", () => {
    expect(indexHtml).toContain('<div id="app"></div>');
    expect(indexHtml).toContain('<script type="module" src="./src/main.ts">');
    expect(indexHtml).not.toContain('class="sidebar icon-sidebar"');
    expect(indexHtml).not.toContain('id="react-root"');
    expect(indexHtml).not.toContain('id="settings-root"');
  });

  it("renders the Objective landing icon rail from the React app shell", () => {
    expect(desktopShell).toContain("AppSidebar");
    expect(desktopShell).toContain('from "./components/app-sidebar";');
    expect(appSidebar).toContain("function AppSidebar()");
    expect(appSidebar).toContain("function AppSidebarProvider");
    expect(appSidebar).toContain("open={false}");
    expect(appSidebar).toContain('collapsible="icon"');
    expect(appSidebar).toContain('className="border-none"');
    expect(appSidebar).toContain("SidebarGroup");
    expect(appSidebar).toContain('from "@repo/ui-v2/components/ui/sidebar";');
    expect(appSidebar).toContain("SidebarMenuButton");
    expect(appSidebar).toContain(
      'className="overflow-visible group-data-[collapsible=icon]:overflow-visible"'
    );
    expect(appSidebar).toContain(
      'className="absolute inset-x-0 top-1/2 -translate-y-1/2"'
    );
    expect(appSidebar).toContain('aria-label="New chat"');
    expect(appSidebar).toContain('aria-label="Recent chats"');
    expect(appSidebar).toContain("New Chat");
    expect(appSidebar).toContain("Recent Chats");
    expect(appSidebar).toContain(
      'tooltip={{ children: "New Chat", hidden: false }}'
    );
    expect(appSidebar).toContain(
      'tooltip={{ children: "Recent Chats", hidden: false }}'
    );
    expect(localSidebar).toContain('side="right"');
    expect(appSidebar).toContain('aria-label="Add objective"');
    expect(desktopShell).toContain("left-(--sidebar-width-icon)");
    expect(appSidebar).toContain("function ObjectiveIndicator");
    expect(appSidebar).toContain(
      'className={cn("justify-center", appRegionNoDrag)}'
    );
    expect(appSidebar).toContain("animate-objective-gradient");
    expect(appSidebar).toContain("bg-[length:400%_400%]");
    expect(appSidebar).toContain("from-chart-3 via-chart-4 to-chart-5");
    expect(appSidebar).toContain("from-chart-1 via-chart-2 to-chart-4");
    expect(appSidebar).toContain("from-chart-5 via-chart-3 to-destructive");

    expect(appSidebar).not.toContain('className="objective-sidebar-card"');
    expect(appSidebar).not.toContain('className="nav objective-nav"');
    expect(appSidebar).not.toContain("icon-sidebar__");
    expect(appSidebar).not.toContain('const swatchClass = "size-2.5');
    expect(appSidebar).not.toContain("blur-md");
    expect(appSidebar).not.toContain("animate-pulse");
    expect(appSidebar).not.toContain("bg-conic");
    expect(appSidebar).not.toContain("from-primary");
    expect(appSidebar).not.toContain("via-ring");
    expect(appSidebar).not.toContain("to-accent");
    expect(appSidebar).not.toContain("via-muted-foreground");
    expect(appSidebar).not.toContain("motion-safe:animate-objective-gradient");
    expect(appSidebar).not.toContain("filter:");
    expect(appSidebar).not.toContain("shape-displacement");
    expect(appSidebar).not.toContain("dangerouslySetInnerHTML");
    expect(appSidebar).not.toContain("Mission Control");
    expect(appSidebar).not.toContain("Mode Core Prism 1");
    expect(appSidebar).not.toContain("Runtime signal");
  });

  it("uses the ui-v2 Base UI shadcn system for the sidebar migration", () => {
    expect(packageJson.dependencies).toMatchObject({
      "@repo/ui-v2": "workspace:*",
    });
    expect(uiV2PackageJson.dependencies).toMatchObject({
      "@base-ui/react": "catalog:",
      "class-variance-authority": "catalog:",
      clsx: "catalog:",
      "tailwind-merge": "catalog:",
    });
    expect(componentsJson).toContain('"style": "base-rhea"');
    expect(componentsJson).toContain('"iconLibrary": "hugeicons"');
    expect(localButton).toContain("@base-ui/react/button");
    expect(localSidebar).toContain("@base-ui/react/use-render");
    expect(localSidebar).toContain("function SidebarProvider");
    expect(localButton).toContain('icon: "size-8"');
    expect(packageJson.dependencies).not.toHaveProperty(
      "@radix-ui/react-dropdown-menu"
    );
    expect(packageJson.dependencies).not.toHaveProperty("clsx");
    expect(packageJson.devDependencies).not.toHaveProperty("clsx");
    expect(sourceFiles).not.toContain('from "../ui"');
    expect(sourceFiles).not.toContain('variant="iconRail"');
  });
});
