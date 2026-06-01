import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

// Typed error codes — the authoritative discriminant for error rendering.
// Known errors carry their canonical message here; `error` is for dynamic
// validation messages only (e.g. "Please enter a valid email address").
export const authErrorCodes = ["account_not_found"] as const;
export type AuthErrorCode = (typeof authErrorCodes)[number];

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  account_not_found:
    "We couldn't find a Lightfast account for that email. Create an account to continue.",
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
