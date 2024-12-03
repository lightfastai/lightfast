import { db } from "@dahlia/db/client";
import {
  createDatabase,
  createDbClient,
  getDatabaseUri,
  updateDatabaseSchema,
} from "@dahlia/db/tenant/client";
import { Workspace } from "@dahlia/db/tenant/schema";
import { Database, User } from "@vendor/db/app/schema";

import { inngest } from "~/inngest/client";

/**
 * Handles the creation of a user in the database.
 *
 * @todo 1. Send welcome email to user
 * @todo 2. Create a multi-tenant database for the user
 */
export const handleCreateUser = inngest.createFunction(
  { id: "handle-create-user" },
  { event: "user/created" },
  async ({ event, step }) => {
    /**
     * Add user to database
     * @todo 1. Handle the error if it occurs. What should we do?
     * @todo 2. Log error
     * @todo 3. Handle the missing username & primary_email_address_id. Can this even happen?
     */
    const user = await step.run("app.insert.user", async () => {
      if (!event.data.username) {
        throw new Error("Missing username");
      }

      if (!event.data.email_addresses[0]?.email_address) {
        throw new Error("Missing email");
      }

      const [result] = await db
        .insert(User)
        .values({ clerkId: event.data.id })
        .returning();

      if (!result) {
        throw new Error("Failed to insert user");
      }

      return result;
    });

    // create a tenant db for the user
    const dbId = await step.run("app.create.db", async () => {
      return createDatabase();
    });

    // get the db uri
    const uri = await step.run("app.get.db.uri", async () => {
      return getDatabaseUri(dbId);
    });

    // update the db schema
    await step.run("app.update.db.schema", async () => {
      return updateDatabaseSchema(uri, "../db/src/tenant/src/migrations");
    });

    // update the main app db with the new tenant db id
    await step.run("app.update.db.user", async () => {
      await db
        .insert(Database)
        .values({ dbId, userId: user.id })
        // check if the user already has a database
        .onConflictDoNothing();
    });

    /**
     * Create a workspace for the user
     * @todo 1. Handle the error if it occurs. What should we do?
     * @todo 2. Log error
     * @todo 3. Handle this in it's own function
     */
    const workspace = await step.run("tenant.insert.workspace", async () => {
      const [result] = await createDbClient(uri)
        .insert(Workspace)
        .values({})
        .returning();

      if (!result) {
        console.error("failed to insert workspace", { userId: user.id });
        throw new Error("Failed to insert workspace");
      }

      return result;
    });

    return {
      message: "OK",
    };
  },
);
