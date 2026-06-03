import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("MCP environment validation wiring", () => {
  it("validates DB env requirements in the MCP env schema", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('from "@db/app/env"');
    expect(envSource).toContain("extends: [vercel(), dbEnv, sentryEnv]");
  });

  it("evaluates the MCP env schema during Next config loading", () => {
    const nextConfigSource = readFileSync(
      resolve(appRoot, "next.config.ts"),
      "utf8"
    );

    expect(nextConfigSource).toContain('import "./src/env"');
  });
});
