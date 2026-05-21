import { isContractProcedure } from "@orpc/contract";
import { describe, expect, it } from "vitest";

import { apiContract } from "../contract";

describe("apiContract", () => {
  it("exposes system.health as a contract procedure", () => {
    expect(isContractProcedure(apiContract.system.health)).toBe(true);
  });

  it("exposes opportunities.create as a contract procedure", () => {
    expect(isContractProcedure(apiContract.opportunities.create)).toBe(true);
  });

  it("exposes opportunities.get as a contract procedure", () => {
    expect(isContractProcedure(apiContract.opportunities.get)).toBe(true);
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

  it("opportunities.create declares POST /opportunities with 202 success", () => {
    const def = (
      apiContract.opportunities.create as {
        "~orpc": {
          route?: { method?: string; path?: string; successStatus?: number };
        };
      }
    )["~orpc"];
    expect(def.route?.method).toBe("POST");
    expect(def.route?.path).toBe("/opportunities");
    expect(def.route?.successStatus).toBe(202);
  });

  it("opportunities.get declares GET /opportunities/{id}", () => {
    const def = (
      apiContract.opportunities.get as {
        "~orpc": { route?: { method?: string; path?: string } };
      }
    )["~orpc"];
    expect(def.route?.method).toBe("GET");
    expect(def.route?.path).toBe("/opportunities/{id}");
  });
});
