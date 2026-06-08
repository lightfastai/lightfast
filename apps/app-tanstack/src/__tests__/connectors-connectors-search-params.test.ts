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
      scope: "team",
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
      scope: "team",
    });
  });

  it("preserves personal scope and defaults invalid scopes to team", () => {
    expect(
      normalizeConnectorsSearch({
        scope: "personal",
      })
    ).toEqual({
      connector: null,
      error: null,
      scope: "personal",
    });
    expect(
      normalizeConnectorsSearch({
        scope: "workspace",
      })
    ).toEqual({
      connector: null,
      error: null,
      scope: "team",
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
    expect(
      validateConnectorsSearch({
        scope: "personal",
      })
    ).toEqual({
      scope: "personal",
    });
  });
});
