import { describe, expect, it } from "vitest";
import {
  normalizeDecisionsSearch,
  parseDecisionProviders,
  parseDecisionStatuses,
  serializeDecisionValues,
  toggleDecisionValue,
  validateDecisionsSearch,
} from "./decisions-search-params";

describe("decisions search params", () => {
  it("normalizes route search values for the Decisions route", () => {
    expect(
      normalizeDecisionsSearch({
        decision: "decision_123",
        provider: "linear,x",
        q: "incident",
        status: "failed",
      })
    ).toEqual({
      decision: "decision_123",
      provider: "linear,x",
      q: "incident",
      status: "failed",
    });

    expect(
      normalizeDecisionsSearch({
        decision: "",
        provider: ["linear"],
        q: 42,
        status: null,
      })
    ).toEqual({
      decision: null,
      provider: "",
      q: "",
      status: "",
    });
  });

  it("validates search params by omitting default values", () => {
    expect(
      validateDecisionsSearch({
        decision: "",
        provider: "",
        q: "",
        status: "",
      })
    ).toEqual({});

    expect(
      validateDecisionsSearch({
        decision: "decision_123",
        provider: "linear",
        q: "incident",
        status: "failed",
      })
    ).toEqual({
      decision: "decision_123",
      provider: "linear",
      q: "incident",
      status: "failed",
    });
  });

  it("parses filter lists as allowed unique values", () => {
    expect(parseDecisionProviders("linear,unknown,x,linear")).toEqual([
      "linear",
      "x",
    ]);
    expect(parseDecisionStatuses("failed,running,bogus,failed")).toEqual([
      "failed",
      "running",
    ]);
  });

  it("serializes and toggles filter values", () => {
    expect(serializeDecisionValues(["linear", "x"])).toBe("linear,x");
    expect(serializeDecisionValues([])).toBe("");
    expect(toggleDecisionValue(["linear"], "x")).toEqual(["linear", "x"]);
    expect(toggleDecisionValue(["linear", "x"], "linear")).toEqual(["x"]);
  });
});
