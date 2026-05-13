import type { Route } from "next";
import {
  createLoader,
  createSerializer,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

const signInSteps = ["email", "code", "activate"] as const;
const signUpSteps = ["email", "code"] as const;

// Typed error codes — the authoritative discriminant for error rendering.
// Known errors carry their canonical message here; `error` is for dynamic
// validation messages only (e.g. "Please enter a valid email address").
export const authErrorCodes = ["waitlist", "account_not_found"] as const;
export type AuthErrorCode = (typeof authErrorCodes)[number];

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  waitlist:
    "Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available.",
  account_not_found:
    "No Lightfast account is linked to this GitHub account. Sign up to create one.",
};

export const signInSearchParams = {
  step: parseAsStringLiteral(signInSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  token: parseAsString,
  errorCode: parseAsStringLiteral(authErrorCodes),
};

export const signUpSearchParams = {
  step: parseAsStringLiteral(signUpSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  ticket: parseAsString,
  __clerk_ticket: parseAsString, // Clerk invitation URL parameter
  errorCode: parseAsStringLiteral(authErrorCodes),
};

export const loadSignInSearchParams = createLoader(signInSearchParams);
export const loadSignUpSearchParams = createLoader(signUpSearchParams);

export const serializeSignInParams = createSerializer<
  typeof signInSearchParams,
  Route<string>,
  Route<string>
>(signInSearchParams);
export const serializeSignUpParams = createSerializer<
  typeof signUpSearchParams,
  Route<string>,
  Route<string>
>(signUpSearchParams);
