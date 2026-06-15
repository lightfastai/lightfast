import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8"
);
const desktopShell = readFileSync(
  new URL("../src/react/desktop-shell.tsx", import.meta.url),
  "utf8"
);
const packageJson = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8")
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const uiV2PackageJson = JSON.parse(
  readFileSync(
    new URL("../../../../../packages/ui-v2/package.json", import.meta.url),
    "utf8"
  )
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const sourceFiles = readFileSync(
  new URL("../src/react/desktop-shell.tsx", import.meta.url),
  "utf8"
);
const componentsJson = readFileSync(
  new URL("../../../../../packages/ui-v2/components.json", import.meta.url),
  "utf8"
);
const localButton = readFileSync(
  new URL(
    "../../../../../packages/ui-v2/src/components/ui/button.tsx",
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
    expect(desktopShell).toContain("function IconSidebar()");
    expect(desktopShell).toContain("w-[52px]");
    expect(desktopShell).toContain("items-start justify-center pt-8");
    expect(desktopShell).toContain(
      'import { Button } from "@repo/ui-v2/components/ui/button";'
    );
    expect(desktopShell).toContain(
      'from "@repo/ui-v2/components/ui/tooltip";'
    );
    expect(desktopShell).toContain('aria-label="New chat"');
    expect(desktopShell).toContain('aria-label="Recent chats"');
    expect(desktopShell).toContain("New Chat");
    expect(desktopShell).toContain("Recent Chats");
    expect(desktopShell).toContain('side="right"');
    expect(desktopShell).toContain('aria-label="Add objective"');
    expect(desktopShell).toContain('variant="ghost"');
    expect(desktopShell).toContain('size="icon-sm"');
    expect(desktopShell).toContain('"left-[52px]"');
    expect(desktopShell).toContain("function ObjectiveIndicator");
    expect(desktopShell).toContain("animate-objective-gradient");
    expect(desktopShell).toContain("bg-[length:400%_400%]");
    expect(desktopShell).toContain("from-[#ef4444] via-[#f43f5e] to-[#a855f7]");
    expect(desktopShell).toContain("from-[#06b6d4] via-[#3b82f6] to-[#4f46e5]");
    expect(desktopShell).toContain("from-[#f59e0b] via-[#f97316] to-[#e11d48]");

    expect(desktopShell).not.toContain('className="objective-sidebar-card"');
    expect(desktopShell).not.toContain('className="nav objective-nav"');
    expect(desktopShell).not.toContain("icon-sidebar__");
    expect(desktopShell).not.toContain('const swatchClass = "size-2.5');
    expect(desktopShell).not.toContain("blur-md");
    expect(desktopShell).not.toContain("animate-pulse");
    expect(desktopShell).not.toContain("bg-conic");
    expect(desktopShell).not.toContain("from-primary");
    expect(desktopShell).not.toContain("via-ring");
    expect(desktopShell).not.toContain("to-accent");
    expect(desktopShell).not.toContain("via-muted-foreground");
    expect(desktopShell).not.toContain("motion-safe:animate-objective-gradient");
    expect(desktopShell).not.toContain("filter:");
    expect(desktopShell).not.toContain("shape-displacement");
    expect(desktopShell).not.toContain("dangerouslySetInnerHTML");
    expect(desktopShell).not.toContain("Mission Control");
    expect(desktopShell).not.toContain("Mode Core Prism 1");
    expect(desktopShell).not.toContain("Runtime signal");
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
    expect(localButton).toContain('@base-ui/react/button');
    expect(localButton).toContain('icon: "size-8"');
    expect(packageJson.dependencies).not.toHaveProperty("@radix-ui/react-dropdown-menu");
    expect(packageJson.dependencies).not.toHaveProperty("clsx");
    expect(packageJson.devDependencies).not.toHaveProperty("clsx");
    expect(sourceFiles).not.toContain('from "../ui"');
    expect(sourceFiles).not.toContain('variant="iconRail"');
  });
});
