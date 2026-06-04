import { isClerkAPIResponseError } from "@clerk/tanstack-react-start/errors";
import { AUTH_ERROR_MESSAGES, type AuthErrorCode } from "./search-params";

export type MappedAuthError =
  | { kind: "code"; errorCode: AuthErrorCode }
  | { kind: "inline"; message: string; retryAfter?: number }
  | { kind: "success" }
  | { kind: "redirect"; target: string };

const SUCCESS_REDIRECT = "/";

type ClerkApiErrorShape = {
  code?: string;
  longMessage?: string;
  message?: string;
};

type ClerkApiResponseErrorShape = {
  errors: ClerkApiErrorShape[];
  retryAfter?: number;
};

function asClerkAPIError(err: unknown): ClerkApiErrorShape | null {
  if (!err) {
    return null;
  }
  if (isClerkAPIResponseError(err)) {
    return (err as ClerkApiResponseErrorShape).errors[0] ?? null;
  }
  const e = err as ClerkApiErrorShape;
  return typeof e.code === "string" ? e : null;
}

export function mapOtpClerkError(err: unknown): MappedAuthError {
  const e = asClerkAPIError(err);
  if (!e) {
    return { kind: "inline", message: "Authentication failed" };
  }

  switch (e.code) {
    case "sign_up_restricted_waitlist":
      return { kind: "inline", message: "Authentication failed" };
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
        ? (err as ClerkApiResponseErrorShape).retryAfter
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
      return {
        kind: "inline",
        message: e.longMessage ?? e.message ?? "Authentication failed",
      };
  }
}

export function authErrorMessage(code: AuthErrorCode): string {
  return AUTH_ERROR_MESSAGES[code];
}
