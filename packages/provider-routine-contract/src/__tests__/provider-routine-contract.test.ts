import { describe, expect, it } from "vitest";
import {
  parseProviderRoutineId,
  providerRoutineCallInputSchema,
  providerRoutineFindInputSchema,
  providerRoutineId,
  providerRoutineIdSchema,
  providerRoutineSourceSurfaceSchema,
} from "../index";

describe("provider routine ids", () => {
  it("formats and parses provider routine ids", () => {
    const routineId = providerRoutineId("linear", "create_issue");

    expect(routineId).toBe("linear__create_issue");
    expect(parseProviderRoutineId(routineId)).toEqual({
      provider: "linear",
      providerToolName: "create_issue",
    });
    expect(providerRoutineIdSchema.parse(routineId)).toBe(routineId);
  });

  it("preserves provider tool names containing double underscores", () => {
    expect(parseProviderRoutineId("linear__foo__bar")).toEqual({
      provider: "linear",
      providerToolName: "foo__bar",
    });
  });

  it("rejects unsupported routine ids", () => {
    expect(() => providerRoutineIdSchema.parse("foo__create_issue")).toThrow();
    expect(() => providerRoutineId("linear", "Create Issue")).toThrow();
    expect(() => parseProviderRoutineId("linear_create_issue")).toThrow();
  });
});

describe("proxy schemas", () => {
  it("accepts chat as a provider routine source surface", () => {
    expect(providerRoutineSourceSurfaceSchema.parse("chat")).toBe("chat");
  });

  it("parses compact find input", () => {
    expect(
      providerRoutineFindInputSchema.parse({
        includeSchema: true,
        limit: 5,
        provider: "linear",
        query: "create issue",
      })
    ).toEqual({
      includeSchema: true,
      limit: 5,
      provider: "linear",
      query: "create issue",
    });
  });

  it("requires proxy call input to be a JSON object", () => {
    expect(
      providerRoutineCallInputSchema.parse({
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).toEqual({
      input: { title: "Bug" },
      routineId: "linear__create_issue",
    });

    expect(() =>
      providerRoutineCallInputSchema.parse({
        input: ["not", "an", "object"],
        routineId: "linear__create_issue",
      })
    ).toThrow();
  });
});
