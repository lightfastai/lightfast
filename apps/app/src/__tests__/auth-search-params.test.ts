import { describe, expect, it } from "vitest";
import {
  parseAuthErrorCode,
  parseAuthErrorMessage,
} from "~/auth/search-params";

describe("auth search param parsing", () => {
  it("preserves valid auth error codes and ignores unknown values", () => {
    expect(parseAuthErrorCode("account_not_found")).toBe("account_not_found");
    expect(parseAuthErrorCode("unknown")).toBeNull();
    expect(parseAuthErrorCode(null)).toBeNull();
    expect(parseAuthErrorCode("null")).toBeNull();
  });

  it("preserves valid inline errors and ignores absent or null-like values", () => {
    expect(parseAuthErrorMessage("Check your email for a new code.")).toBe(
      "Check your email for a new code."
    );
    expect(parseAuthErrorMessage(undefined)).toBeNull();
    expect(parseAuthErrorMessage(null)).toBeNull();
    expect(parseAuthErrorMessage("")).toBeNull();
    expect(parseAuthErrorMessage("null")).toBeNull();
  });
});
