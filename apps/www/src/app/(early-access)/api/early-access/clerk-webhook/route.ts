import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import type { WebhookEvent } from "@vendor/clerk/server";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import { env } from "~/env";

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

  switch (eventType) {
    case "waitlistEntry.created": {
      try {
        await inngest.send({
          name: "early-access/contact.create",
          data: {
            email: event.data.email_address,
          },
        });
      } catch (error) {
        console.error("Error: Could not send email:", error);
        return NextResponse.json(
          {
            message: "Error occured while issuing request to send email",
            ok: false,
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          message: "Issued request to send email",
          ok: true,
        },
        { status: 201 },
      );
    }
    default: {
      break;
    }
  }

  return new NextResponse("Error Occured", { status: 400 });
}
