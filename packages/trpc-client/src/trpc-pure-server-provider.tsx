import { db } from "@vendor/db/client";
import { $SessionType } from "@vendor/openauth";
import { createCaller } from "@vendor/trpc";

export const trpc = createCaller({
  session: {
    type: $SessionType.Enum.server,
  },
  db: db,
});
