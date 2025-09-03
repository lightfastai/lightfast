/**
 * Cloud application TRPC context
 */

import { auth } from "@vendor/clerk/server";
import { db } from "@db/cloud/client";
import type { BaseContext } from "@vendor/trpc/core";

/**
 * Cloud-specific context that extends the base context
 */
export interface CloudContext extends BaseContext {
  session: Awaited<ReturnType<typeof auth>>;
  db: typeof db;
}

/**
 * Creates the context for cloud TRPC procedures
 */
export async function createCloudContext(opts: {
  headers: Headers;
}): Promise<CloudContext> {
  const session = await auth();

  return {
    headers: opts.headers,
    session,
    db,
  };
}