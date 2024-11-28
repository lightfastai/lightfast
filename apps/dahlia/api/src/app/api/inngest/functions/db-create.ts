import { db } from "@repo/db/app/client";
import { Database } from "@repo/db/app/schema";
import {
  createDatabase,
  getDatabaseUri,
  updateDatabaseSchema,
} from "@repo/db/tenant/client";
import { inngest } from "@repo/events/client";

// create a database for a user
export const createDatabaseFunction = inngest.createFunction(
  { id: "db-create" },
  { event: "user/created" },
  async ({ event, step }) => {
    // create a tenant db for the user
    const dbId = await step.run("create-database", async () => {
      return createDatabase();
    });

    // get the db uri
    const uri = await step.run("get-db-uri", async () => {
      return getDatabaseUri(dbId);
    });

    // update the db schema
    await step.run("update-db-schema", async () => {
      return updateDatabaseSchema(
        uri,
        // @ts-expect-error this is a relative path, easilt broken. do something...
        "../../../packages/db/src/tenant/src/migrations",
      );
    });

    // update the main app db with the new tenant db id
    await step.run("update-main-db", async () => {
      await db
        .insert(Database)
        .values({ dbId, userId: event.data.user.id })
        // check if the user already has a database
        .onConflictDoNothing();
    });
  },
);
