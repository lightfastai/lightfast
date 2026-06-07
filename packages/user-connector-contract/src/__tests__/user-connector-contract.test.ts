import { describe, expect, it } from "vitest";
import {
  userConnectorCallInputSchema,
  userConnectorFindInputSchema,
  userConnectorRoutineId,
  userConnectorRoutineIdSchema,
} from "../index";

describe("user connector contract", () => {
  it("formats Granola routine ids", () => {
    expect(userConnectorRoutineId("granola", "search_notes")).toBe(
      "granola__search_notes"
    );
    expect(userConnectorRoutineIdSchema.parse("granola__search_notes")).toBe(
      "granola__search_notes"
    );
    expect(
      userConnectorRoutineIdSchema.safeParse("linear__viewer").success
    ).toBe(false);
  });

  it("parses find and call inputs", () => {
    expect(
      userConnectorFindInputSchema.parse({
        includeSchema: true,
        provider: "granola",
        query: "actions",
      })
    ).toEqual({
      includeSchema: true,
      provider: "granola",
      query: "actions",
    });

    expect(
      userConnectorCallInputSchema.parse({
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).toEqual({
      input: { query: "SOC2" },
      routineId: "granola__search_notes",
    });
  });
});
