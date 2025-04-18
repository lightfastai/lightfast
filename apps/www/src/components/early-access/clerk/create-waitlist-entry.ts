import { ok, ResultAsync } from "neverthrow";

import type { ClerkWaitlistEntry } from "./types";
import { env } from "~/env";
import {
  ClerkError,
  UnknownError,
  WaitlistError,
} from "./create-waitlist-entry-errors";

const CLERK_API_URL = "https://api.clerk.com/v1";

const createWaitlistEntryUnsafe = async ({ email }: { email: string }) => {
  const response = await fetch(`${CLERK_API_URL}/waitlist_entries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
    },
    body: JSON.stringify({ email_address: email }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ClerkError(errorText);
  }

  const data = (await response.json()) as ClerkWaitlistEntry;
  return ok(data);
};

export const createWaitlistEntrySafe = ({ email }: { email: string }) =>
  ResultAsync.fromThrowable(
    () => createWaitlistEntryUnsafe({ email }),
    (error) => {
      if (error instanceof ClerkError) {
        return new WaitlistError(error.message);
      }
      return new UnknownError("Unknown error while creating waitlist entry");
    },
  );
