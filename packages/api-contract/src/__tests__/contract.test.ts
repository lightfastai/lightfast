import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { apiContract } from "../contract";
import {
  createSignalInput,
  createSignalOutput,
  listSignalsInput,
  listSignalsOutput,
} from "../schemas/signals";
import { systemHealthOutput } from "../schemas/system";

const packageRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(packageRoot, path), "utf8");
}

describe("apiContract", () => {
  it("keeps public API route metadata as plain contract data", () => {
    expect(apiContract.system.health.route).toMatchObject({
      method: "GET",
      path: "/system/health",
    });
    expect(apiContract.system.health.outputSchema).toBe(systemHealthOutput);

    expect(apiContract.signals.list.route).toMatchObject({
      method: "GET",
      path: "/signals",
    });
    expect(apiContract.signals.list.inputSchema).toBe(listSignalsInput);
    expect(apiContract.signals.list.outputSchema).toBe(listSignalsOutput);

    expect(apiContract.signals.create.route).toMatchObject({
      method: "POST",
      path: "/signals",
      successStatus: 202,
    });
    expect(apiContract.signals.create.inputSchema).toBe(createSignalInput);
    expect(apiContract.signals.create.outputSchema).toBe(createSignalOutput);

    expect(apiContract.signals.get.route).toMatchObject({
      method: "GET",
      path: "/signals/{id}",
    });
  });

  it("does not expose oRPC procedure internals or package dependencies", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      dependencies?: Record<string, string>;
    };
    const contractSource = source("src/contract.ts");
    const mcpSource = source("src/mcp.ts");

    expect(packageJson.dependencies?.["@orpc/contract"]).toBeUndefined();
    expect(contractSource).not.toContain("@orpc/contract");
    expect(contractSource).not.toContain("~orpc");
    expect(mcpSource).not.toContain("@orpc/contract");
    expect(mcpSource).not.toContain("isContractProcedure");
    expect(apiContract.signals.create).not.toHaveProperty("~orpc");
  });
});
