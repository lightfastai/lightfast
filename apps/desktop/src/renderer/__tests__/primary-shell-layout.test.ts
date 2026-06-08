import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const desktopShell = readFileSync(
  new URL("../src/react/desktop-shell.tsx", import.meta.url),
  "utf8"
);
const rendererMain = readFileSync(
  new URL("../src/main.ts", import.meta.url),
  "utf8"
);

describe("primary shell layout", () => {
  it("keeps the content container aligned below the compact header surface", () => {
    expect(desktopShell).toContain('const surfaceClass = "bg-[#f9f9f9]');
    expect(desktopShell).toContain('"mt-10 h-[calc(100%_-_40px)]"');
    expect(desktopShell).toContain('"absolute top-0 right-0 z-[1] h-10"');
    expect(desktopShell).toContain('"left-[52px]"');
  });

  it("pins the renderer root to the viewport so the sidebar reaches the bottom", () => {
    expect(rendererMain).toContain("h-screen overflow-hidden");
    expect(rendererMain).toContain('"relative", "flex", "h-full"');
    expect(desktopShell).toContain("h-full w-[52px]");
  });

  it("lets the content surface own the sidebar/header edge treatment", () => {
    expect(desktopShell).not.toContain("border-r");
    expect(desktopShell).not.toContain("border-b");
    expect(desktopShell).toContain("rounded-tl-xl");
    expect(desktopShell).toContain("border-t border-l");
  });
});
