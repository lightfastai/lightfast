import { describe, expect, it } from "vitest";
import {
  normalizeConnectorsSearch,
  validateConnectorsSearch,
} from "~/connectors/connectors-search-params";

describe("connectors search params", () => {
  it("preserves connector and error strings", () => {
    expect(
      normalizeConnectorsSearch({
        connector: "linear",
        error: "access_denied",
      })
    ).toEqual({
      connector: "linear",
      error: "access_denied",
    });
  });

  it("normalizes absent, empty, and non-string params to null", () => {
    expect(
      normalizeConnectorsSearch({
        connector: "",
        error: ["access_denied"],
      })
    ).toEqual({
      connector: null,
      error: null,
    });
  });

  it("validates search params by omitting null values", () => {
    expect(
      validateConnectorsSearch({
        connector: "x",
        error: "",
      })
    ).toEqual({
      connector: "x",
    });
  });
});
