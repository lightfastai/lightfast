export const TEST_ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";

export function githubUserAccountAttempt(
  overrides: Partial<{
    codeVerifier: string;
    lightfastUserId: string;
    returnTo: string;
  }> = {}
) {
  return {
    codeVerifier: "verifier_123",
    lightfastUserId: "user_1",
    returnTo: "/account/tasks/github",
    ...overrides,
  };
}
