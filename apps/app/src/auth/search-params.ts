export const authErrorCodes = ["account_not_found"] as const;
export type AuthErrorCode = (typeof authErrorCodes)[number];

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  account_not_found:
    "We couldn't find a Lightfast account for that email. Create an account to continue.",
};

export function parseAuthErrorCode(value: unknown): AuthErrorCode | null {
  return typeof value === "string" &&
    (authErrorCodes as readonly string[]).includes(value)
    ? (value as AuthErrorCode)
    : null;
}

export function parseAuthErrorMessage(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value !== "null"
    ? value
    : null;
}
