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
      return updateDatabaseSchema(uri);
    });

    // update the main app db with the new tenant db id
    await step.run("update-main-db", async () => {
      // return updateMainDb(event.data.user.id, dbId);
      // @TODO: implement
    });
  },
);
