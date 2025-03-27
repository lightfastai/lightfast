import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import type { UserJSON, WebhookEvent } from "@vendor/clerk/server";

import { env } from "~/env";
import { inngest } from "~/inngest/client";

/**
 * Handles the creation of a user in the database. A webhook is sent
 * by Clerk when a user is created. We then send an event to Inngest
 * which is handled by the `handle-create-user` function.
 *
 * @todo 1. Analytics flow starts here...
 * @todo 2. Potentially remove this by figuring out how to automatically send
 *        events to Inngest from Clerk.
 */
const handleUserCreated = (data: UserJSON) => {
  inngest.send({
    name: "user/created",
    data,
  });

  return new Response("User created", { status: 201 });
};

export const POST = async (request: Request): Promise<Response> => {
  if (!env.CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error("Error: No webhook secret");
    return NextResponse.json({ message: "Not configured", ok: false });
  }

  // Get the headers
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("Error: No svix headers");
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = (await request.json()) as object;
  const body = JSON.stringify(payload);

  // Create a new SVIX instance with your secret.
  const webhook = new Webhook(env.CLERK_WEBHOOK_SIGNING_SECRET);

  let event: WebhookEvent | undefined;

  // Verify the payload with the headers
  try {
    event = webhook.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (error) {
    console.error("Error: Could not verify webhook:", error);
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Get the ID and type
  const { id } = event.data;
  const eventType = event.type;

  console.log(`Received webhook with ID ${id} and event type of ${eventType}`);

  let response: Response = new Response("", { status: 201 });

  switch (eventType) {
    case "user.created": {
      response = handleUserCreated(event.data);
      break;
    }
    default: {
      break;
    }
  }

  return response;
};
