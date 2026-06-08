import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../src/styles.css", import.meta.url),
  "utf8"
);
const postcssConfig = readFileSync(
  new URL("../../../postcss.config.mjs", import.meta.url),
  "utf8"
);
const packageJson = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8")
) as {
  devDependencies?: Record<string, string>;
};

describe("desktop Tailwind setup", () => {
  it("keeps styles.css as Tailwind plumbing only", () => {
    expect(styles).toContain('@import "tailwindcss";');
    expect(styles).toContain('@source "../index.html";');
    expect(styles).toContain('@source "./**/*.{ts,tsx}";');
    expect(styles).toContain(
      '@source "../../../../../packages/ui/src/**/*.{ts,tsx}";'
    );
    expect(styles).toContain("@theme inline");

    const selectors = styles
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[.#[:a-zA-Z].*\{/.test(line))
      .filter((line) => !line.startsWith("@"));

    expect(selectors).toEqual([]);
    expect(styles).not.toContain("color-mix(");
    expect(styles).not.toContain("-webkit-app-region");
  });

  it("configures PostCSS to run Tailwind", () => {
    expect(postcssConfig).toContain('"@tailwindcss/postcss": {}');
  });

  it("declares Tailwind v4 toolchain dependencies", () => {
    expect(packageJson.devDependencies).toMatchObject({
      "@tailwindcss/postcss": "catalog:tailwind4",
      postcss: "catalog:tailwind4",
      tailwindcss: "catalog:tailwind4",
    });
  });
});
