import { SessionType } from "@vendor/clerk/types";
import { db } from "@vendor/db/client";
import { createCaller } from "@vendor/trpc";

export const trpc = createCaller({
  session: {
    type: SessionType.Server,
  },
  db: db,
});
