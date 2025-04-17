import type { NextApiRequest } from "next";

import type { WaitlistEntryJSON } from "@vendor/clerk/server";
import { verifyWebhook } from "@vendor/clerk/server";
import { sendEmail } from "@vendor/email";

import { env } from "~/env";

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
    const email = await sendEmail({
      from: "noreply@mail.lightfast.ai",
      to: data.email_address,
      subject: "Welcome to Lightfast",
      text: "Welcome to Lightfast",
    });
    console.log("Email sent successfully:", email);
  } catch (error) {
    console.error("Error: Could not send email:", error);
    throw error;
  }
};

export async function POST(req: NextApiRequest) {
  try {
    const evt = await verifyWebhook(req, {
      signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
    });

    // Do something with payload
    // For this guide, log payload to console
    const { id } = evt.data;
    const eventType = evt.type;
    console.log(
      `Received webhook with ID ${id} and event type of ${eventType}`,
    );
    console.log("Webhook payload:", evt.data);

    if (evt.type === "waitlistEntry.created") {
      await handleWaitlistEntryCreated(evt.data);
    }

    return new Response("Webhook received", { status: 200 });
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error verifying webhook", { status: 400 });
  }
}
