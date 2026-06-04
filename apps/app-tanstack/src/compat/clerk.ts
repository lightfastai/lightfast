export class ClerkAPIResponseError extends Error {
  errors: Array<{ code?: string }> = [];
  status = 500;
}

export function isClerkAPIResponseError(
  error: unknown
): error is ClerkAPIResponseError {
  return error instanceof ClerkAPIResponseError;
}

export function isUserLockedError() {
  return false;
}
