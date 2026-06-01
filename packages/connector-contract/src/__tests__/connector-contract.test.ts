import { describe, expect, it } from "vitest";
import {
  CONNECTABLE_CONNECTOR_PROVIDERS,
  CONNECTOR_CATALOG,
  connectorRuntimeToolName,
  connectorRuntimeToolNameSchema,
  connectorToolNameSchema,
  parseConnectorRuntimeToolName,
} from "../index";

describe("connector catalog", () => {
  it("keeps Linear connectable and coming-soon providers cataloged", () => {
    expect(CONNECTABLE_CONNECTOR_PROVIDERS).toEqual(["linear"]);
    expect(CONNECTOR_CATALOG.map((entry) => entry.provider)).toContain(
      "linear"
    );
    expect(
      CONNECTOR_CATALOG.filter((entry) => entry.catalogStatus === "coming_soon")
        .length
    ).toBeGreaterThanOrEqual(3);
  });

  it("uses Lightfast as the v1 builder", () => {
    expect(
      CONNECTOR_CATALOG.every((entry) => entry.builder === "Lightfast")
    ).toBe(true);
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

  it("rejects unsupported provider tool names", () => {
    expect(connectorToolNameSchema.parse("list_issues")).toBe("list_issues");
    expect(connectorToolNameSchema.parse("issue.search")).toBe("issue.search");
    expect(connectorToolNameSchema.parse("issue-search")).toBe("issue-search");
    expect(() => connectorToolNameSchema.parse("Create Issue")).toThrow();
  });
});
