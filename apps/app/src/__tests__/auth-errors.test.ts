import { ClerkAPIResponseError } from "@clerk/nextjs/errors";
import { describe, expect, it } from "vitest";
import { mapOtpClerkError } from "~/app/(auth)/_hooks/auth-errors";

// Helper: synthesize a real ClerkAPIResponseError so isClerkAPIResponseError
// (which checks `constructor.kind === "ClerkAPIResponseError"`) returns true.
function makeApiResponseError(opts: {
  code: string;
  message?: string;
  longMessage?: string;
  status?: number;
  retryAfter?: number;
}) {
  return new ClerkAPIResponseError(opts.message ?? "FAPI error", {
    data: [
      {
        code: opts.code,
        message: opts.message ?? "msg",
        long_message: opts.longMessage,
        meta: {},
      },
    ],
    status: opts.status ?? 400,
    clerkTraceId: "trace_test",
    retryAfter: opts.retryAfter,
  });
}

describe("mapOtpClerkError — unwrapped runtime shape (current clerk-js Future API)", () => {
  it("maps sign_up_restricted_waitlist to waitlist code", () => {
    expect(mapOtpClerkError({ code: "sign_up_restricted_waitlist" })).toEqual({
      kind: "code",
      errorCode: "waitlist",
    });
  });

  it("maps verification_already_verified to success", () => {
    expect(mapOtpClerkError({ code: "verification_already_verified" })).toEqual(
      {
        kind: "success",
      }
    );
  });

  it("maps session_exists to redirect to the post-auth resolver", () => {
    expect(mapOtpClerkError({ code: "session_exists" })).toEqual({
      kind: "redirect",
      target: "/",
    });
  });

  it("maps ticket_expired to inline copy", () => {
    expect(mapOtpClerkError({ code: "ticket_expired" })).toEqual({
      kind: "inline",
      message: "This invitation link has expired. Request a new one.",
    });
  });

  it("maps too_many_requests to inline rate-limit message without retryAfter", () => {
    expect(mapOtpClerkError({ code: "too_many_requests" })).toEqual({
      kind: "inline",
      message: "Too many attempts. Please wait a moment and try again.",
      retryAfter: undefined,
    });
  });

  it("maps user_locked to inline lock message", () => {
    expect(mapOtpClerkError({ code: "user_locked" })).toEqual({
      kind: "inline",
      message: "Account locked. Please try again later.",
    });
  });

  it("prefers longMessage for unknown codes", () => {
    expect(
      mapOtpClerkError({
        code: "form_param_format_invalid",
        longMessage: "Long form message.",
        message: "short",
      })
    ).toEqual({ kind: "inline", message: "Long form message." });
  });

  it("falls back to message when longMessage missing", () => {
    expect(mapOtpClerkError({ code: "x", message: "short" })).toEqual({
      kind: "inline",
      message: "short",
    });
  });

  it("falls back to generic message for null err", () => {
    expect(mapOtpClerkError(null)).toEqual({
      kind: "inline",
      message: "Authentication failed",
    });
  });

  it("falls back to generic message for malformed err (no code field)", () => {
    expect(mapOtpClerkError({ message: "no code" })).toEqual({
      kind: "inline",
      message: "Authentication failed",
    });
  });
});

describe("mapOtpClerkError — ClerkAPIResponseError instance (documented contract)", () => {
  it("extracts errors[0].code for waitlist", () => {
    const err = makeApiResponseError({ code: "sign_up_restricted_waitlist" });
    expect(mapOtpClerkError(err)).toEqual({
      kind: "code",
      errorCode: "waitlist",
    });
  });

  it("extracts retryAfter for too_many_requests and renders countdown copy", () => {
    const err = makeApiResponseError({
      code: "too_many_requests",
      status: 429,
      retryAfter: 30,
    });
    expect(mapOtpClerkError(err)).toEqual({
      kind: "inline",
      message: "Too many attempts. Please wait 30s and try again.",
      retryAfter: 30,
    });
  });

  it("maps user_locked from errors[0]", () => {
    const err = makeApiResponseError({ code: "user_locked" });
    expect(mapOtpClerkError(err)).toEqual({
      kind: "inline",
      message: "Account locked. Please try again later.",
    });
  });

  it("prefers errors[0].long_message for unknown codes", () => {
    const err = makeApiResponseError({
      code: "form_param_format_invalid",
      longMessage: "Long form message.",
      message: "short",
    });
    expect(mapOtpClerkError(err)).toEqual({
      kind: "inline",
      message: "Long form message.",
    });
  });
});
