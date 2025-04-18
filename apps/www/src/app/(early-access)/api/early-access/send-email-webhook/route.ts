import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { err, ok, safeTry } from "neverthrow";
import { Webhook } from "svix";

import type { WebhookEvent } from "@vendor/clerk/server";

import { validateEmail } from "~/components/early-access/early-access-form.validation";
import { emailConfig } from "~/config/email";
import { env } from "~/env";
import { ResendError, sendEmail, UnknownError } from "~/lib/email";
import EarlyAccessEntryEmail from "~/templates/early-access-entry-email";

export const sendEmailResult = ({ email }: { email: string }) =>
  safeTry(async function* () {
    yield* validateEmail({ email }).mapErr((error) => {
      console.error("Error: Could not validate email:", error);
      return err(error);
    });
    yield* await sendEmail({
      from: emailConfig.support,
      to: email,
      react: EarlyAccessEntryEmail({ email }),
      subject: "Welcome to the Lightly Early Access Waitlist",
    }).mapErr((error) => {
      console.error("Error: Could not send email:", error);
      if (error instanceof ResendError) {
        return err(error);
      }

      if (error instanceof UnknownError) {
        return err(error);
      }

      return error;
    });
    return ok(new Response("Email sent", { status: 200 }));
  });

export async function POST(request: Request) {
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

  const response: Response = new Response("", { status: 201 });

  switch (eventType) {
    case "waitlistEntry.created": {
      sendEmailResult({ email: event.data.email_address }).mapErr((error) => {
        console.error("Error: Could not send email:", error);
        return new Response(error.error.message, { status: 400 });
      });
      break;
    }
    default: {
      break;
    }
  }

  return response;
}
