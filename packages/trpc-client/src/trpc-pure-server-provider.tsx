import { db } from "@vendor/db/client";
import { createCaller } from "@vendor/trpc";

export const trpc = createCaller({
  session: null,
  db: db,
});