import { auth as clerkAuth } from "@clerk/nextjs/server";

import type { Session } from "./types";

/**
 * Light wrapper around clerkAuth to transform the return type
 * @todo: 1. add db user id to the session
 * @todo: 2. try/catch and return null if clerkAuth throws
 */
export const auth = async (): Promise<Session | null> => {
  const session = await clerkAuth();
  if (!session.userId) {
    return null;
  }
  return {
    user: {
      id: session.userId,
      clerkId: session.userId,
    },
  };
};
