import { createDbClient } from "@vendor/db/create-db-client";
import { $SessionType } from "@vendor/openauth";
import { createServerOnlyCaller } from "@vendor/trpc/callers/server-only";

export const createTRPCPureProvider = (url: string) =>
  createServerOnlyCaller({
    session: {
      type: $SessionType.Enum.server,
    },
    db: createDbClient(url),
  });

export type TRPCPureServerProvider = ReturnType<typeof createTRPCPureProvider>;
