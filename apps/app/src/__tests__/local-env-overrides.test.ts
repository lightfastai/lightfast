import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8")) as T;
}

describe("local env overrides", () => {
  it("loads local infra overrides before Vercel-pulled app env files", () => {
    const expectedScripts = new Map([
      [
        "apps/app/package.json",
        {
          "with-env":
            "dotenv -e ./.env.overrides.local -e ./.vercel/.env.development.local --",
          "with-env:local":
            "dotenv -e ./.env.overrides.local -e ./.vercel/.env.development.local --",
          "with-env:vercel": "dotenv -e ./.vercel/.env.development.local --",
        },
      ],
      [
        "apps/platform/package.json",
        {
          "with-env":
            "dotenv -e ./.env.overrides.local -e ./.vercel/.env.development.local --",
          "with-env:local":
            "dotenv -e ./.env.overrides.local -e ./.vercel/.env.development.local --",
          "with-env:vercel": "dotenv -e ./.vercel/.env.development.local --",
        },
      ],
      [
        "apps/mcp/package.json",
        {
          "with-env":
            "dotenv -e ../app/.env.overrides.local -e ../app/.vercel/.env.development.local -e ./.vercel/.env.development.local --",
          "with-env:local":
            "dotenv -e ../app/.env.overrides.local -e ../app/.vercel/.env.development.local -e ./.vercel/.env.development.local --",
          "with-env:vercel":
            "dotenv -e ../app/.vercel/.env.development.local -e ./.vercel/.env.development.local --",
        },
      ],
      [
        "api/app/package.json",
        {
          "with-env":
            "dotenv -e ../../apps/app/.env.overrides.local -e ../../apps/app/.vercel/.env.development.local --",
          "with-env:local":
            "dotenv -e ../../apps/app/.env.overrides.local -e ../../apps/app/.vercel/.env.development.local --",
          "with-env:vercel":
            "dotenv -e ../../apps/app/.vercel/.env.development.local --",
        },
      ],
      [
        "db/app/package.json",
        {
          "with-env":
            "dotenv -e ../../apps/app/.env.overrides.local -e ../../apps/app/.vercel/.env.development.local --",
          "with-env:local":
            "dotenv -e ../../apps/app/.env.overrides.local -e ../../apps/app/.vercel/.env.development.local --",
          "with-env:vercel":
            "dotenv -e ../../apps/app/.vercel/.env.development.local --",
        },
      ],
    ]);

    for (const [path, expectedScriptsByName] of expectedScripts) {
      const packageJson = readJson<{ scripts: Record<string, string> }>(path);
      for (const [scriptName, expected] of Object.entries(
        expectedScriptsByName
      )) {
        expect(packageJson.scripts[scriptName], `${path} ${scriptName}`).toBe(
          expected
        );
      }
    }
  });

  it("tracks local override files in package build inputs", () => {
    const appTurbo = readJson<{ tasks: { build: { inputs: string[] } } }>(
      "apps/app/turbo.json"
    );
    const platformTurbo = readJson<{ tasks: { build: { inputs: string[] } } }>(
      "apps/platform/turbo.json"
    );
    const mcpTurbo = readJson<{ tasks: { build: { inputs: string[] } } }>(
      "apps/mcp/turbo.json"
    );

    expect(appTurbo.tasks.build.inputs).toContain(".env.overrides.local");
    expect(platformTurbo.tasks.build.inputs).toContain(".env.overrides.local");
    expect(mcpTurbo.tasks.build.inputs).toContain(
      "../app/.env.overrides.local"
    );
  });
});
