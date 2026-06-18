import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbRoot = resolve(import.meta.dirname, "../..");

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) {
      return walkFiles(path);
    }
    return [path];
  });
}

describe("migration runner boundary", () => {
  it("keeps Drizzle migrator imports outside the production src tree", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(dbRoot, "package.json"), "utf8")
    ) as { scripts: { "db:migrate": string } };
    const srcSource = walkFiles(resolve(dbRoot, "src"))
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => !path.includes("/__tests__/"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(existsSync(resolve(dbRoot, "src/migrate.ts"))).toBe(false);
    expect(packageJson.scripts["db:migrate"]).toContain("./scripts/migrate.ts");
    expect(srcSource).not.toContain(
      "drizzle-orm/planetscale-serverless/migrator"
    );
  });
});
