import { describe, expect, it } from "vitest";
import {
  allDecisionsParamValues,
  type DecisionViewConfig,
  selectionToConfig,
  viewConfigToParamValues,
} from "~/decisions/decisions-views-model";

describe("decisions views model", () => {
  it("serializes a saved view config into search param values", () => {
    const config: DecisionViewConfig = {
      filters: {
        providers: ["linear", "x"],
        statuses: ["failed"],
      },
    };

    expect(viewConfigToParamValues(config)).toEqual({
      provider: "linear,x",
      status: "failed",
    });
  });

  it("captures the current filter selection as a saved view config", () => {
    expect(
      selectionToConfig({
        providers: ["linear"],
        statuses: ["running", "failed"],
      })
    ).toEqual({
      filters: {
        providers: ["linear"],
        statuses: ["running", "failed"],
      },
    });
  });

  it("clears all saved view params", () => {
    expect(allDecisionsParamValues()).toEqual({
      provider: "",
      status: "",
    });
  });
});
