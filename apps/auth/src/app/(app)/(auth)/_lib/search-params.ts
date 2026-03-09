import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

const signInSteps = ["email", "code", "activate"] as const;
const signUpSteps = ["email", "code"] as const;

export const signInSearchParams = {
  step: parseAsStringLiteral(signInSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  token: parseAsString,
  waitlist: parseAsString,
};

export const signUpSearchParams = {
  step: parseAsStringLiteral(signUpSteps).withDefault("email"),
  email: parseAsString,
  error: parseAsString,
  ticket: parseAsString,
  __clerk_ticket: parseAsString, // Clerk invitation URL parameter
  waitlist: parseAsString,
};

export const loadSignInSearchParams = createLoader(signInSearchParams);
export const loadSignUpSearchParams = createLoader(signUpSearchParams);
