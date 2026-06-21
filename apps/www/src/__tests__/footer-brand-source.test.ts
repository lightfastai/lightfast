import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

function appSource(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("marketing footer brand", () => {
  it("renders the shared Lightfast logo in the former arcade position", () => {
    const footerSource = appSource(
      "src/app/(site)/(marketing)/_components/footer.tsx"
    );

    expect(footerSource).toContain(
      'import { Logo } from "@repo/ui-v2/components/brand/logo";'
    );
    expect(footerSource).toContain(
      '<Logo className="text-foreground" size="xl" />'
    );
    expect(footerSource).not.toContain("FooterArcadeSlot");
    expect(footerSource).not.toContain("footer-arcade-slot");
  });

  it("removes the Space Invaders footer integration from www", () => {
    const packageSource = appSource("package.json");
    const stylesSource = appSource("src/styles/styles.css");

    expect(packageSource).not.toContain("@repo/space-invaders");
    expect(stylesSource).not.toContain("space-invaders");
    expect(
      existsSync(
        resolve(
          appRoot,
          "src/app/(site)/(marketing)/_components/footer-arcade-slot.tsx"
        )
      )
    ).toBe(false);
  });

  it("removes the dedicated Space Invaders workspaces", () => {
    expect(existsSync(resolve(repoRoot, "packages/space-invaders"))).toBe(
      false
    );
    expect(existsSync(resolve(repoRoot, "packages/space-invaders-react"))).toBe(
      false
    );
  });

  it("removes the old footer arcade design artifacts", () => {
    const archivedGameDocs = [
      "docs/superpowers/plans/2026-06-19-footer-arcade-engine-and-space-invaders-implementation.md",
      "docs/superpowers/specs/2026-06-19-footer-arcade-engine-design.md",
      "docs/superpowers/specs/2026-06-19-footer-space-invaders-design.md",
    ] as const;

    for (const path of archivedGameDocs) {
      expect(existsSync(resolve(repoRoot, path)), path).toBe(false);
    }
  });
});
