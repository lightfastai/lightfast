import type { ClerkAPIError } from "@vendor/clerk";
import { isClerkAPIResponseError } from "@vendor/clerk";
import { AUTH_ERROR_MESSAGES, type AuthErrorCode } from "../_lib/search-params";

export type MappedAuthError =
  | { kind: "code"; errorCode: AuthErrorCode }
  | { kind: "inline"; message: string; retryAfter?: number }
  | { kind: "success" }
  | { kind: "redirect"; target: string };

const SUCCESS_REDIRECT = "/";

function asClerkAPIError(err: unknown): ClerkAPIError | null {
  if (!err) {
    return null;
  }
  if (isClerkAPIResponseError(err)) {
    return err.errors[0] ?? null;
  }
  const e = err as Partial<ClerkAPIError>;
  return typeof e.code === "string" ? (e as ClerkAPIError) : null;
}

export function mapOtpClerkError(err: unknown): MappedAuthError {
  const e = asClerkAPIError(err);
  if (!e) {
    return { kind: "inline", message: "Authentication failed" };
  }

  switch (e.code) {
    case "sign_up_restricted_waitlist":
      return { kind: "code", errorCode: "waitlist" };
    case "form_identifier_not_found":
    case "identifier_not_found":
    case "user_not_found":
      return { kind: "code", errorCode: "account_not_found" };
    case "verification_already_verified":
      return { kind: "success" };
    case "session_exists":
      return { kind: "redirect", target: SUCCESS_REDIRECT };
    case "ticket_expired":
      return {
        kind: "inline",
        message: "This invitation link has expired. Request a new one.",
      };
    case "too_many_requests": {
      const retryAfter = isClerkAPIResponseError(err)
        ? err.retryAfter
        : undefined;
      return {
        kind: "inline",
        message: retryAfter
          ? `Too many attempts. Please wait ${retryAfter}s and try again.`
          : "Too many attempts. Please wait a moment and try again.",
        retryAfter,
      };
    }
    case "user_locked":
      return {
        kind: "inline",
        message: "Account locked. Please try again later.",
      };
    default:
      return { kind: "inline", message: e.longMessage ?? e.message };
  }
}

export function mapOAuthClerkError(err: unknown): MappedAuthError {
  const e = asClerkAPIError(err);
  if (!e) {
    return { kind: "inline", message: "Authentication failed" };
  }

  if (e.code === "sign_up_restricted_waitlist") {
    return { kind: "code", errorCode: "waitlist" };
  }
  if (
    e.code === "form_identifier_not_found" ||
    e.code === "identifier_not_found" ||
    e.code === "user_not_found"
  ) {
    return { kind: "code", errorCode: "account_not_found" };
  }
  if (e.code === "session_exists") {
    return { kind: "redirect", target: SUCCESS_REDIRECT };
  }
  return { kind: "inline", message: e.longMessage ?? e.message };
}

export function authErrorMessage(code: AuthErrorCode): string {
  return AUTH_ERROR_MESSAGES[code];
}
