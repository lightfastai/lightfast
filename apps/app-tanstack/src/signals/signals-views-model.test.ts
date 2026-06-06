import { describe, expect, it } from "vitest";
import {
  allSignalsParamValues,
  type SignalViewConfig,
  selectionToConfig,
  viewConfigToParamValues,
} from "./signals-views-model";

describe("signals views model", () => {
  it("serializes a saved view config into search param values", () => {
    const config: SignalViewConfig = {
      filters: {
        dispositions: ["actionable", "needs_context"],
        kinds: ["engage"],
        peopleRouted: true,
        priorities: ["urgent", "high"],
      },
    };

    expect(viewConfigToParamValues(config)).toEqual({
      disposition: "actionable,needs_context",
      kind: "engage",
      people: "routed",
      priority: "urgent,high",
    });
  });

  it("captures the current filter selection as a saved view config", () => {
    expect(
      selectionToConfig({
        dispositions: ["not_actionable"],
        kinds: ["fix", "review"],
        peopleRouted: false,
        priorities: ["low"],
      })
    ).toEqual({
      filters: {
        dispositions: ["not_actionable"],
        kinds: ["fix", "review"],
        peopleRouted: false,
        priorities: ["low"],
      },
    });
  });

  it("clears all saved view params", () => {
    expect(allSignalsParamValues()).toEqual({
      disposition: "",
      kind: "",
      people: "all",
      priority: "",
    });
  });
});
