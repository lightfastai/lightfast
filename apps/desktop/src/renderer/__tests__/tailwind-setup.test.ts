import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../src/styles.css", import.meta.url),
  "utf8"
);
const uiV2Styles = readFileSync(
  new URL("../../../../../packages/ui-v2/src/globals.css", import.meta.url),
  "utf8"
);
const rendererEntry = readFileSync(
  new URL("../src/main.ts", import.meta.url),
  "utf8"
);
const postcssConfig = readFileSync(
  new URL("../../../postcss.config.mjs", import.meta.url),
  "utf8"
);
const uiV2PostcssConfig = readFileSync(
  new URL("../../../../../packages/ui-v2/postcss.config.mjs", import.meta.url),
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

function getCssBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = uiV2Styles.match(
    new RegExp(`${escapedSelector} \\{(?<body>[\\s\\S]*?)\\n\\}`)
  );

  expect(match?.groups?.body).toBeDefined();

  return match?.groups?.body ?? "";
}

function getCssVariable(block: string, variable: string) {
  const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`${escapedVariable}: (?<value>[^;]+);`));

  expect(match?.groups?.value).toBeDefined();

  return match?.groups?.value ?? "";
}

describe("desktop Tailwind setup", () => {
  it("keeps desktop styles.css as the app source entry for ui-v2 globals", () => {
    expect(styles).toContain('@import "@repo/ui-v2/globals.css";');
    expect(rendererEntry).toContain('import "@fontsource-variable/geist";');
    expect(styles).toContain('@source "../index.html";');
    expect(styles).toContain('@source "./**/*.{ts,tsx}";');
    expect(styles).toContain(
      '@source "../../../../../packages/ui/src/**/*.{ts,tsx}";'
    );
    expect(styles).toContain(
      '@source "../../../../../packages/ui-v2/src/**/*.{ts,tsx}";'
    );
    expect(styles).not.toContain(":root {");
    expect(styles).not.toContain(".dark {");
    expect(styles).not.toContain("@layer base");
    expect(styles).not.toContain("-webkit-app-region");
  });

  it("keeps ui-v2 globals as Tailwind and shadcn theme plumbing", () => {
    expect(uiV2Styles).toContain('@import "tailwindcss/index.css";');
    expect(uiV2Styles).toContain('@import "tw-animate-css";');
    expect(uiV2Styles).toContain('@import "shadcn/tailwind.css";');
    expect(uiV2Styles).toContain('@source "./**/*.{ts,tsx}";');
    expect(uiV2Styles).toContain("@custom-variant dark");
    expect(uiV2Styles).toContain("@theme inline");
    expect(uiV2Styles).toContain("--color-background: var(--background);");
    expect(uiV2Styles).toContain(
      "--animate-objective-gradient: objective-gradient 3s ease infinite;"
    );
    expect(uiV2Styles).toContain("@keyframes objective-gradient");
    expect(uiV2Styles).toContain(":root {");
    expect(uiV2Styles).toContain(".dark {");
    expect(uiV2Styles).toContain("@layer base");
    expect(uiV2Styles).toContain("@apply border-border outline-ring/50;");
    expect(uiV2Styles).toContain("@apply bg-background text-foreground;");

    const selectors = uiV2Styles
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[.#[:a-zA-Z].*\{/.test(line))
      .filter((line) => !line.startsWith("@"));

    expect(selectors).toEqual([
      ":root {",
      ".dark {",
      "body {",
      '[role="button"]:not(:disabled) {',
      "html {",
      ".font-mono {",
    ]);
    expect(uiV2Styles).not.toContain("color-mix(");
    expect(uiV2Styles).not.toContain("-webkit-app-region");
  });

  it("configures PostCSS to run Tailwind", () => {
    expect(postcssConfig).toContain(
      'export { default } from "@repo/ui-v2/postcss.config";'
    );
    expect(uiV2PostcssConfig).toContain('"@tailwindcss/postcss": {}');
  });

  it("uses the OpenAI-derived shadcn sidebar tokens from ui-v2", () => {
    expect(getCssBlock(":root")).toContain("--sidebar: oklch(0.982 0 0);");
    expect(getCssBlock(":root")).toContain(
      "--sidebar-ring: oklch(0.529 0.173 254.975);"
    );

    const darkBlock = getCssBlock(".dark");
    expect(getCssVariable(darkBlock, "--sidebar")).toBe(
      getCssVariable(darkBlock, "--background")
    );
    expect(getCssVariable(darkBlock, "--sidebar")).toBe(
      "oklch(0.1339 0.0026 106.74)"
    );
    expect(getCssBlock(".dark")).toContain(
      "--sidebar-ring: oklch(0.626 0.205 254.947);"
    );
  });

  it("declares Tailwind v4 toolchain dependencies", () => {
    expect(packageJson.devDependencies).toMatchObject({
      "@tailwindcss/postcss": "catalog:tailwind4",
      postcss: "catalog:tailwind4",
      tailwindcss: "catalog:tailwind4",
    });
    expect(packageJson.dependencies).toMatchObject({
      "@fontsource-variable/geist": "catalog:",
      "@repo/ui-v2": "workspace:*",
    });
    expect(uiV2PackageJson.devDependencies).toMatchObject({
      shadcn: "catalog:",
      "tw-animate-css": "catalog:",
    });
  });
});
