import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "code-block.tsx"), "utf8");

describe("CodeBlock highlighter bundling", () => {
  it("does not import Shiki's full WASM-backed bundle at runtime", () => {
    expect(source).not.toMatch(/import\s+\{[^}]+\}\s+from\s+["']shiki["']/);
    expect(source).toContain('from "@shikijs/core"');
    expect(source).toContain('from "@shikijs/engine-javascript"');
  });
});
