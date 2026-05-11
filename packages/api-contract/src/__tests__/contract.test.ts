import { isContractProcedure } from "@orpc/contract";
import { describe, expect, it } from "vitest";

import { apiContract } from "../contract";

describe("apiContract", () => {
  it("exposes system.health as a contract procedure", () => {
    expect(isContractProcedure(apiContract.system.health)).toBe(true);
  });

  it("system.health declares GET /system/health", () => {
    const def = (
      apiContract.system.health as {
        "~orpc": { route?: { method?: string; path?: string } };
      }
    )["~orpc"];
    expect(def.route?.method).toBe("GET");
    expect(def.route?.path).toBe("/system/health");
  });

  it("system.health declares an output schema", () => {
    const def = (
      apiContract.system.health as {
        "~orpc": { outputSchema?: unknown };
      }
    )["~orpc"];
    expect(def.outputSchema).toBeDefined();
  });
});
