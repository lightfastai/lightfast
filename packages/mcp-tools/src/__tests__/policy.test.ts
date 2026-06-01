import { apiContract, lightfastMcpToolPolicy } from "@repo/api-contract";
import { describe, expect, it } from "vitest";

import {
  createLightfastMcpToolDefinitions,
  validateMcpPolicyCoverage,
} from "../policy";

describe("createLightfastMcpToolDefinitions", () => {
  it("creates stable exposed tool definitions from contract policy", () => {
    expect(() =>
      validateMcpPolicyCoverage(apiContract, lightfastMcpToolPolicy)
    ).not.toThrow();

    const tools = createLightfastMcpToolDefinitions({
      contract: apiContract,
      policy: lightfastMcpToolPolicy,
    });

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "lightfast_signals_create",
      "lightfast_signals_get",
      "lightfast_system_health",
    ]);
    expect(
      tools.find((tool) => tool.name === "lightfast_signals_create")
    ).toMatchObject({
      contractPath: "signals.create",
      requiredScope: "mcp:signals:write",
      kind: "write",
      requiresBoundOrg: true,
    });
  });
});
