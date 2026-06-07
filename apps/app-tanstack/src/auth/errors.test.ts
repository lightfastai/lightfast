import { describe, expect, it } from "vitest";
import { authErrorMessage, mapOtpClerkError } from "./errors";

describe("mapOtpClerkError", () => {
  it("maps account lookup failures to the stable account-not-found message", () => {
    expect(mapOtpClerkError({ code: "identifier_not_found" })).toEqual({
      kind: "code",
      errorCode: "account_not_found",
    });
    expect(authErrorMessage("account_not_found")).toBe(
      "We couldn't find a Lightfast account for that email. Create an account to continue."
    );
  });

  it("maps known Clerk OTP states to stable control-flow results", () => {
    expect(mapOtpClerkError({ code: "verification_already_verified" })).toEqual(
      {
        kind: "success",
      }
    );
    expect(mapOtpClerkError({ code: "session_exists" })).toEqual({
      kind: "redirect",
      target: "/",
    });
  });

  it("maps known inline Clerk errors to stable user-facing messages", () => {
    expect(mapOtpClerkError({ code: "ticket_expired" })).toEqual({
      kind: "inline",
      message: "This invitation link has expired. Request a new one.",
    });
    expect(mapOtpClerkError({ code: "too_many_requests" })).toEqual({
      kind: "inline",
      message: "Too many attempts. Please wait a moment and try again.",
      retryAfter: undefined,
    });
    expect(mapOtpClerkError({ code: "user_locked" })).toEqual({
      kind: "inline",
      message: "Account locked. Please try again later.",
    });
  });

  it("falls back to Clerk-provided messages or a generic auth failure", () => {
    expect(
      mapOtpClerkError({
        code: "unexpected_code",
        longMessage: "Use the latest code from your inbox.",
        message: "Wrong code.",
      })
    ).toEqual({
      kind: "inline",
      message: "Use the latest code from your inbox.",
    });
    expect(mapOtpClerkError({ code: "unexpected_code" })).toEqual({
      kind: "inline",
      message: "Authentication failed",
    });
    expect(mapOtpClerkError(null)).toEqual({
      kind: "inline",
      message: "Authentication failed",
    });
  });
});
