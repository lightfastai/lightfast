import { createDbClient } from "@vendor/db/create-db-client";
import { $SessionType } from "@vendor/openauth";
import { createServerOnlyCaller } from "@vendor/trpc/callers/server-only";

export const createTRPCPureProvider = (dbUrl: string) =>
  createServerOnlyCaller({
    session: {
      type: $SessionType.Enum.server,
    },
    db: createDbClient(dbUrl),
  });
