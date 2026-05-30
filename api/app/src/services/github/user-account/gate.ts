import { getActiveUserSourceControlAccount, type Database } from "@db/app";

import { throwDiagnostic } from "../../../diagnostics";

export async function requireGitHubUserAccount(input: {
  clerkUserId: string;
  db: Database;
}) {
  const account = await getActiveUserSourceControlAccount(
    input.db,
    input.clerkUserId
  );
  if (!account) {
    throwDiagnostic({
      trpcCode: "FORBIDDEN",
      diagnostic: {
        code: "GITHUB_USER_ACCOUNT_REQUIRED",
        message: "Connect your GitHub account before using this feature.",
        repair: { id: "connect-github-account" },
      },
    });
  }
  return account;
}
