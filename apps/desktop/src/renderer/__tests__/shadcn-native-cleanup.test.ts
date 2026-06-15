import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rendererSrc = new URL("../src/", import.meta.url);
const uiV2Root = new URL("../../../../../packages/ui-v2/", import.meta.url);

function readRendererSourceFiles(dir = rendererSrc): Array<{
  path: string;
  source: string;
}> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryUrl = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      dir
    );
    if (entry.isDirectory()) {
      return readRendererSourceFiles(entryUrl);
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) {
      return [];
    }
    const path = entryUrl.pathname;
    return [{ path, source: readFileSync(entryUrl, "utf8") }];
  });
}

const sourceFiles = readRendererSourceFiles();
const combinedSource = sourceFiles.map(({ source }) => source).join("\n");
const desktopPackageJson = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8")
) as {
  dependencies?: Record<string, string>;
};
const componentsJson = readFileSync(
  new URL("components.json", uiV2Root),
  "utf8"
);
const localButton = readFileSync(
  new URL("src/components/ui/button.tsx", uiV2Root),
  "utf8"
);
const localDropdownMenu = readFileSync(
  new URL("src/components/ui/dropdown-menu.tsx", uiV2Root),
  "utf8"
);
const localAvatar = readFileSync(
  new URL("src/components/ui/avatar.tsx", uiV2Root),
  "utf8"
);
const localTooltip = readFileSync(
  new URL("src/components/ui/tooltip.tsx", uiV2Root),
  "utf8"
);
const allowedObjectiveIndicatorHexColors = [
  "#ef4444",
  "#f43f5e",
  "#a855f7",
  "#06b6d4",
  "#3b82f6",
  "#4f46e5",
  "#f59e0b",
  "#f97316",
  "#e11d48",
] as const;

describe("desktop shadcn native cleanup", () => {
  it("uses ui-v2 Base UI shadcn primitives for the renderer", () => {
    expect(componentsJson).toContain('"style": "base-rhea"');
    expect(combinedSource).toContain("@repo/ui-v2/components/ui");
    expect(localButton).toContain('@base-ui/react/button');
    expect(localDropdownMenu).toContain('@base-ui/react/menu');
    expect(localAvatar).toContain('@base-ui/react/avatar');
    expect(localTooltip).toContain('@base-ui/react/tooltip');
    expect(combinedSource).not.toMatch(/@radix-ui\/react-/);
  });

  it("keeps renderer UI on shadcn theme tokens outside objective indicator colors", () => {
    const offenders = sourceFiles
      .filter(({ source }) => {
        const sourceWithoutAllowedObjectiveColors =
          allowedObjectiveIndicatorHexColors.reduce(
            (nextSource, color) => nextSource.replaceAll(color, ""),
            source
          );

        return /#[0-9a-fA-F]{3,8}|\[\.electron-dark_&\]/.test(
          sourceWithoutAllowedObjectiveColors
        );
      })
      .map(({ path }) => path.replace(rendererSrc.pathname, ""));

    expect(offenders).toEqual([]);
  });

  it("uses Hugeicons instead of Lucide for desktop renderer icons", () => {
    expect(combinedSource).toContain("@hugeicons/react");
    expect(combinedSource).toContain("@hugeicons/core-free-icons");
    expect(combinedSource).not.toContain("lucide-react");
    expect(desktopPackageJson.dependencies).toMatchObject({
      "@hugeicons/core-free-icons": "catalog:",
      "@hugeicons/react": "catalog:",
    });
    expect(desktopPackageJson.dependencies).not.toHaveProperty("lucide-react");
  });

  it("keeps tooltip primitives available for primary sidebar icon actions", () => {
    expect(localTooltip).toContain("TooltipProvider");
    expect(combinedSource).toContain("TooltipTrigger");
    expect(combinedSource).toContain("TooltipContent");
    expect(combinedSource).toContain('aria-label="New chat"');
    expect(combinedSource).toContain('aria-label="Recent chats"');
    expect(combinedSource).toContain("New Chat");
    expect(combinedSource).toContain("Recent Chats");
    expect(combinedSource).toContain('side="right"');
  });
});
