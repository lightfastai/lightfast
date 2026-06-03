import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("MCP environment validation wiring", () => {
  it("validates DB env requirements in the MCP env schema", () => {
    const envSource = readFileSync(resolve(appRoot, "src/env.ts"), "utf8");

    expect(envSource).toContain('import "@tanstack/react-start/server-only"');
    expect(envSource).toContain('from "@db/app/env"');
    expect(envSource).toContain('from "@t3-oss/env-core"');
    expect(envSource).toContain("extends: [dbEnv]");
  });

  it("evaluates the MCP env schema during Vite config loading", () => {
    const viteConfigSource = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf8"
    );

    expect(viteConfigSource).toContain('import "./src/env"');
  });
});
