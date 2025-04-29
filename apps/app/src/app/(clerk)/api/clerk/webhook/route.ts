import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

import type { UserJSON } from "@vendor/clerk/server";

import { env } from "~/env";
import { api } from "~/trpc/client/server";

/**
 * Handles the creation of a user in the database. A webhook is sent
 * by Clerk when a user is created. We then send an event to Inngest
 * which is handled by the `handle-create-user` function.
 *
 * @todo 1. Analytics flow starts here...
 * @todo 2. Potentially remove this by figuring out how to automatically send
 *        events to Inngest from Clerk.
 */
const handleUserCreated = async (data: UserJSON) => {
  const emailAddress = data.email_addresses[0]?.email_address;

  if (!emailAddress) {
    console.error("Error: User email address not found");
    return new Response("Error occured -- user email address not found", {
      status: 400,
    });
  }

  try {
    console.log("Creating user in Clerk", data);
    // @important This is a blocking call. If it doesn't return fast, the webhook will fail.
    await api.app.user.create({
      clerkId: data.id,
      emailAddress,
    });

    return new Response("User created", { status: 201 });
  } catch (err) {
    console.error("Error: User not created", err);
    return new Response("Error occured -- user not created", {
      status: 400,
    });
  }
};

export const POST = async (request: NextRequest): Promise<Response> => {
  try {
    const evt = await verifyWebhook(request, {
      signingSecret: env.CLERK_WEBHOOK_SECRET,
    });

    // Get the ID and type
    const { id } = evt.data;
    const eventType = evt.type;

    console.log(
      `Received webhook with ID ${id} and event type of ${eventType}`,
    );
    console.log("Webhook payload:", evt.data);

    let response: Response = new Response("", { status: 201 });

    switch (eventType) {
      case "user.created": {
        response = await handleUserCreated(evt.data);
        break;
      }
      default: {
        break;
      }
    }

    return response;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error verifying webhook", { status: 400 });
  }
};
