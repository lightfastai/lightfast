import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import type { WaitlistEntryJSON, WebhookEvent } from "@vendor/clerk/server";

import { env } from "~/env";
import { mail } from "~/lib/email";

/**
 * Handles the creation of a user in the database. A webhook is sent
 * by Clerk when a user is created. We then send an event to Inngest
 * which is handled by the `handle-create-user` function.
 *
 * @todo 1. Analytics flow starts here...
 * @todo 2. Potentially remove this by figuring out how to automatically send
 *        events to Inngest from Clerk.
 */
const handleWaitlistEntryCreated = async (data: WaitlistEntryJSON) => {
  try {
    const _email = await mail.emails.send({
      from: "noreply@mail.lightfast.ai",
      to: data.email_address,
      subject: "Welcome to Lightfast",
      text: "Welcome to Lightfast",
    });
    console.log("Email sent successfully:", _email);
  } catch (error) {
    console.error("Error: Could not send email:", error);
    throw error;
  }
};

export async function POST(request: Request) {
  try {
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

    let evt: WebhookEvent | undefined;

    // Verify the payload with the headers
    try {
      evt = webhook.verify(body, {
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

    if (evt.type === "waitlistEntry.created") {
      await handleWaitlistEntryCreated(evt.data);
    }

    return new Response("Webhook received", { status: 200 });
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error verifying webhook", { status: 400 });
  }
}
