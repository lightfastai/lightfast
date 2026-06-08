import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8")
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const viteConfig = readFileSync(
  new URL("../../../vite.renderer.config.ts", import.meta.url),
  "utf8"
);
const desktopShell = readFileSync(
  new URL("../src/react/desktop-shell.tsx", import.meta.url),
  "utf8"
);
const primaryRouter = readFileSync(
  new URL("../src/react/primary-router.tsx", import.meta.url),
  "utf8"
);
const rootRoute = readFileSync(
  new URL("../src/routes/__root.tsx", import.meta.url),
  "utf8"
);
const indexRoute = readFileSync(
  new URL("../src/routes/index.tsx", import.meta.url),
  "utf8"
);

describe("desktop TanStack Router setup", () => {
  it("declares router runtime and Vite plugin dependencies", () => {
    expect(packageJson.dependencies).toMatchObject({
      "@tanstack/react-router": "catalog:",
    });
    expect(packageJson.devDependencies).toMatchObject({
      "@tanstack/router-plugin": "catalog:",
    });
  });

  it("runs the TanStack Router Vite plugin before React", () => {
    expect(viteConfig).toContain(
      'import { tanstackRouter } from "@tanstack/router-plugin/vite";'
    );
    expect(viteConfig.indexOf("tanstackRouter({")).toBeGreaterThan(-1);
    expect(viteConfig.indexOf("tanstackRouter({")).toBeLessThan(
      viteConfig.indexOf("react()")
    );
    expect(viteConfig).toContain('target: "react"');
    expect(viteConfig).toContain("autoCodeSplitting: true");
  });

  it("keeps routing inside the primary window boundary only", () => {
    expect(desktopShell).toContain("<PrimaryRouter");
    expect(desktopShell).toContain('windowKind === "primary"');
    expect(desktopShell).toContain('windowKind === "settings"');
    expect(desktopShell).toContain('windowKind === "hud"');
    expect(primaryRouter).toContain("RouterProvider");
    expect(rootRoute).toContain("createRootRouteWithContext");
    expect(indexRoute).toContain('createFileRoute("/")');
    expect(indexRoute).toContain("<AppShell />");
  });
});
