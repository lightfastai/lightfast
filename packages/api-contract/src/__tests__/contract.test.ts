import { isContractProcedure } from "@orpc/contract";
import { describe, expect, it } from "vitest";

import { apiContract } from "../contract";

describe("apiContract", () => {
  it("exposes system.health as a contract procedure", () => {
    expect(isContractProcedure(apiContract.system.health)).toBe(true);
  });

  it("exposes signals.create as a contract procedure", () => {
    expect(isContractProcedure(apiContract.signals.create)).toBe(true);
  });

  it("exposes signals.get as a contract procedure", () => {
    expect(isContractProcedure(apiContract.signals.get)).toBe(true);
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

  it("signals.create declares POST /signals with 202 success", () => {
    const def = (
      apiContract.signals.create as {
        "~orpc": {
          route?: { method?: string; path?: string; successStatus?: number };
        };
      }
    )["~orpc"];
    expect(def.route?.method).toBe("POST");
    expect(def.route?.path).toBe("/signals");
    expect(def.route?.successStatus).toBe(202);
  });

  it("signals.get declares GET /signals/{id}", () => {
    const def = (
      apiContract.signals.get as {
        "~orpc": { route?: { method?: string; path?: string } };
      }
    )["~orpc"];
    expect(def.route?.method).toBe("GET");
    expect(def.route?.path).toBe("/signals/{id}");
  });
});
