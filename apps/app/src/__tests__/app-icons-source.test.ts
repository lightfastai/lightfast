import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const appSrcRoot = resolve(appRoot, "src");

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = resolve(directory, entry);
    const relativePath = relative(appSrcRoot, absolutePath);

    if (relativePath.split("/").includes("__tests__")) {
      return [];
    }

    if (statSync(absolutePath).isDirectory()) {
      return collectSourceFiles(absolutePath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [absolutePath] : [];
  });
}

describe("app icon system", () => {
  it("uses Hugeicons instead of Lucide across app runtime source", () => {
    const lucideImportPattern = /from\s+["']lucide-react["']/;
    const filesWithLucideImports = collectSourceFiles(appSrcRoot)
      .filter((filePath) => lucideImportPattern.test(readFileSync(filePath, "utf8")))
      .map((filePath) => relative(appRoot, filePath));
    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8")
    ) as { dependencies?: Record<string, string> };

    expect(filesWithLucideImports).toEqual([]);
    expect(packageJson.dependencies).not.toHaveProperty("lucide-react");
    expect(packageJson.dependencies).toHaveProperty("@hugeicons/core-free-icons");
    expect(packageJson.dependencies).toHaveProperty("@hugeicons/react");
  });
});
