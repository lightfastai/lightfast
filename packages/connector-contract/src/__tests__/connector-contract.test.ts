import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  CONNECTABLE_CONNECTOR_PROVIDERS,
  CONNECTOR_CATALOG,
  CONNECTOR_PROVIDERS,
  connectorRuntimeToolName,
  connectorRuntimeToolNameSchema,
  connectorToolNameSchema,
  parseConnectorRuntimeToolName,
} from "../index";

describe("connector catalog", () => {
  it("includes X as a connectable provider", () => {
    expect(CONNECTOR_PROVIDERS).toEqual(["linear", "x"]);
    expect(CONNECTABLE_CONNECTOR_PROVIDERS).toEqual(["linear", "x"]);
    expect(CONNECTOR_CATALOG.map((entry) => entry.provider)).toEqual([
      "linear",
      "x",
    ]);
    expect(
      CONNECTOR_CATALOG.every((entry) => entry.catalogStatus === "available")
    ).toBe(true);
  });

  it("uses Lightfast as the v1 builder", () => {
    expect(
      CONNECTOR_CATALOG.every((entry) => entry.builder === "Lightfast")
    ).toBe(true);
  });
});

describe("connector inputs", () => {
  it("validates agent enablement input separately from automation enablement", async () => {
    const contract = (await import("../index")) as {
      connectorSetAgentEnabledInputSchema?: z.ZodType<unknown>;
    };

    expect("connectorSetAgentEnabledInputSchema" in contract).toBe(true);
    expect(
      contract.connectorSetAgentEnabledInputSchema?.parse({
        enabled: true,
        provider: "linear",
      })
    ).toEqual({
      enabled: true,
      provider: "linear",
    });
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
