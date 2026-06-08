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
const sourceFiles = readFileSync(
  new URL("../src/react/desktop-shell.tsx", import.meta.url),
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
      'import { Button } from "@repo/ui/components/ui/button";'
    );
    expect(desktopShell).toContain('aria-label="New chat"');
    expect(desktopShell).toContain('aria-label="History"');
    expect(desktopShell).toContain('aria-label="Add objective"');
    expect(desktopShell).toContain('variant="ghost"');
    expect(desktopShell).toContain('size="icon-sm"');
    expect(desktopShell).toContain('"left-[52px]"');

    expect(desktopShell).not.toContain('className="objective-sidebar-card"');
    expect(desktopShell).not.toContain('className="nav objective-nav"');
    expect(desktopShell).not.toContain("icon-sidebar__");
    expect(desktopShell).not.toContain("Mission Control");
    expect(desktopShell).not.toContain("Mode Core Prism 1");
    expect(desktopShell).not.toContain("Runtime signal");
  });

  it("uses the shared ui package instead of a desktop-local shadcn clone", () => {
    expect(packageJson.dependencies).toMatchObject({
      "@repo/ui": "workspace:*",
    });
    expect(packageJson.dependencies).not.toHaveProperty("clsx");
    expect(packageJson.devDependencies).not.toHaveProperty("clsx");
    expect(sourceFiles).not.toContain('from "../ui"');
    expect(sourceFiles).not.toContain('variant="iconRail"');
  });
});
