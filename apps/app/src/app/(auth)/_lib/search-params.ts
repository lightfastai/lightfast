import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

// Typed error codes — the authoritative discriminant for error rendering.
// Known errors carry their canonical message here; `error` is for dynamic
// validation messages only (e.g. "Please enter a valid email address").
export const authErrorCodes = ["waitlist", "account_not_found"] as const;
export type AuthErrorCode = (typeof authErrorCodes)[number];

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  waitlist:
    "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
  account_not_found:
    "No Lightfast account is linked to this email address. Sign up to create one.",
};

// Shared error-only schema for sign-in and sign-up.
export const authErrorSearchParams = {
  error: parseAsString,
  errorCode: parseAsStringLiteral(authErrorCodes),
};

// Accept-invitation schema includes the ticket.
export const acceptInvitationSearchParams = {
  __clerk_ticket: parseAsString,
  error: parseAsString,
  errorCode: parseAsStringLiteral(authErrorCodes),
};

export const loadAuthErrorSearchParams = createLoader(authErrorSearchParams);
export const loadAcceptInvitationSearchParams = createLoader(
  acceptInvitationSearchParams
);
