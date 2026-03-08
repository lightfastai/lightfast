import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

const signInSteps = ["email", "code", "password", "activate"] as const;
const signUpSteps = ["email", "code", "password"] as const;

export const signInSearchParams = createSearchParamsCache({
  step: parseAsStringLiteral(signInSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  token: parseAsString,
  waitlist: parseAsString,
});

export const signUpSearchParams = createSearchParamsCache({
  step: parseAsStringLiteral(signUpSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  ticket: parseAsString,
  __clerk_ticket: parseAsString, // Clerk invitation URL parameter
  waitlist: parseAsString,
});
