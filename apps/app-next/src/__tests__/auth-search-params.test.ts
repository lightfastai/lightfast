import { describe, expect, it } from "vitest";
import {
  AUTH_ERROR_MESSAGES,
  acceptInvitationSearchParams,
  authErrorCodes,
  authErrorSearchParams,
} from "~/app/(auth)/_lib/search-params";

describe("authErrorCodes", () => {
  it("exports the expected canonical error codes", () => {
    expect(authErrorCodes).toEqual(["account_not_found"]);
  });

  it("has a canonical message for each error code", () => {
    for (const code of authErrorCodes) {
      expect(AUTH_ERROR_MESSAGES[code]).toBeTypeOf("string");
      expect(AUTH_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });
});

describe("authErrorSearchParams", () => {
  it("parses valid errorCode values", () => {
    expect(authErrorSearchParams.errorCode.parse("account_not_found")).toBe(
      "account_not_found"
    );
  });

  it("rejects invalid errorCode values", () => {
    expect(authErrorSearchParams.errorCode.parse("retired_code")).toBe(null);
    expect(authErrorSearchParams.errorCode.parse("invalid")).toBe(null);
    expect(authErrorSearchParams.errorCode.parse("")).toBe(null);
  });

  it("parses arbitrary error strings", () => {
    expect(
      authErrorSearchParams.error.parse("Please enter a valid email")
    ).toBe("Please enter a valid email");
  });
});

describe("acceptInvitationSearchParams", () => {
  it("parses __clerk_ticket strings", () => {
    expect(acceptInvitationSearchParams.__clerk_ticket.parse("tok_abc")).toBe(
      "tok_abc"
    );
  });

  it("parses account_not_found errorCode values", () => {
    expect(
      acceptInvitationSearchParams.errorCode.parse("account_not_found")
    ).toBe("account_not_found");
  });

  it("rejects invalid errorCode values", () => {
    expect(acceptInvitationSearchParams.errorCode.parse("retired_code")).toBe(
      null
    );
    expect(acceptInvitationSearchParams.errorCode.parse("invalid")).toBe(null);
  });
});
