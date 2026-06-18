import { type Database, getActiveUserSourceControlAccount } from "@db/app";

import { AuthzError } from "../../../domain/errors";

export async function requireGitHubUserAccount(input: {
  clerkUserId: string;
  db: Database;
}) {
  const account = await getActiveUserSourceControlAccount(
    input.db,
    input.clerkUserId
  );
  if (!account) {
    throw new AuthzError(
      "GITHUB_USER_ACCOUNT_REQUIRED",
      "Connect your GitHub account before using this feature.",
      { repair: { id: "connect-github-account" } }
    );
  }
  return account;
}
