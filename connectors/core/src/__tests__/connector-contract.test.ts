import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  CONNECTABLE_CONNECTOR_PROVIDERS,
  CONNECTOR_PROVIDERS,
  connectorRuntimeToolName,
  connectorRuntimeToolNameSchema,
  connectorToolNameSchema,
  parseConnectorRuntimeToolName,
  USER_CONNECTOR_PROVIDERS,
  userConnectorProviderSchema,
} from "../index";

describe("provider primitives", () => {
  it("re-exports the client-safe provider lists", () => {
    expect(CONNECTOR_PROVIDERS).toEqual(["linear", "x"]);
    expect(CONNECTABLE_CONNECTOR_PROVIDERS).toEqual(["linear", "x"]);
    expect(USER_CONNECTOR_PROVIDERS).toEqual(["granola"]);
    expect(userConnectorProviderSchema.parse("granola")).toBe("granola");
    expect(userConnectorProviderSchema.safeParse("linear").success).toBe(false);
  });

  it("does not export app-owned catalog or workflow command schemas", async () => {
    const contract = (await import("../index")) as {
      CONNECTOR_CATALOG?: unknown;
      USER_CONNECTOR_CATALOG?: unknown;
      connectorProviderInputSchema?: z.ZodType<unknown>;
      connectorSetAgentEnabledInputSchema?: z.ZodType<unknown>;
      connectorSetAutomationEnabledInputSchema?: z.ZodType<unknown>;
      connectorStartConnectInputSchema?: z.ZodType<unknown>;
      userConnectorProviderInputSchema?: z.ZodType<unknown>;
      userConnectorStartConnectInputSchema?: z.ZodType<unknown>;
    };

    expect("CONNECTOR_CATALOG" in contract).toBe(false);
    expect("USER_CONNECTOR_CATALOG" in contract).toBe(false);
    expect("connectorProviderInputSchema" in contract).toBe(false);
    expect("connectorSetAgentEnabledInputSchema" in contract).toBe(false);
    expect("connectorSetAutomationEnabledInputSchema" in contract).toBe(false);
    expect("connectorStartConnectInputSchema" in contract).toBe(false);
    expect("userConnectorProviderInputSchema" in contract).toBe(false);
    expect("userConnectorStartConnectInputSchema" in contract).toBe(false);
  });
});

describe("connector ownership", () => {
  it("keeps existing org connector providers stable", () => {
    expect(CONNECTABLE_CONNECTOR_PROVIDERS).toEqual(["linear", "x"]);
  });
});

describe("runtime tool names", () => {
  it("formats and parses provider-prefixed runtime tool names", () => {
    const runtimeName = connectorRuntimeToolName("linear", "create_issue");
    expect(runtimeName).toBe("linear__create_issue");
    expect(parseConnectorRuntimeToolName(runtimeName)).toEqual({
      provider: "linear",
      providerToolName: "create_issue",
    });
    expect(connectorRuntimeToolNameSchema.parse(runtimeName)).toBe(runtimeName);
  });

  it("accepts case-preserving X tool names", () => {
    expect(connectorToolNameSchema.parse("getUsersByUsername")).toBe(
      "getUsersByUsername"
    );
    expect(connectorRuntimeToolName("x", "getUsersByUsername")).toBe(
      "x__getUsersByUsername"
    );
    expect(parseConnectorRuntimeToolName("x__getUsersByUsername")).toEqual({
      provider: "x",
      providerToolName: "getUsersByUsername",
    });
  });

  it("rejects runtime tool names with unsupported provider prefixes", () => {
    expect(() =>
      connectorRuntimeToolNameSchema.parse("foo__create_issue")
    ).toThrow();
    expect(() =>
      connectorRuntimeToolName("foo" as "linear", "create_issue")
    ).toThrow();
    expect(() => parseConnectorRuntimeToolName("foo__create_issue")).toThrow();
  });

  it("preserves provider tool names containing double underscores", () => {
    expect(parseConnectorRuntimeToolName("linear__foo__bar")).toEqual({
      provider: "linear",
      providerToolName: "foo__bar",
    });
  });

  it("rejects unsupported provider tool names", () => {
    expect(connectorToolNameSchema.parse("list_issues")).toBe("list_issues");
    expect(connectorToolNameSchema.parse("issue.search")).toBe("issue.search");
    expect(connectorToolNameSchema.parse("issue-search")).toBe("issue-search");
    expect(() => connectorToolNameSchema.parse("Create Issue")).toThrow();
    expect(connectorToolNameSchema.safeParse("get users").success).toBe(false);
    expect(connectorToolNameSchema.safeParse("get/users").success).toBe(false);
    expect(connectorToolNameSchema.safeParse("getUsers!").success).toBe(false);
  });
});
