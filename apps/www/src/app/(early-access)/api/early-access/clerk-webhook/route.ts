import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";

export async function POST(request: NextRequest) {
  try {
    const evt = await verifyWebhook(request);
    // Do something with payload
    // For this guide, log payload to console
    const { id } = evt.data;
    const eventType = evt.type;
    console.log(
      `Received webhook with ID ${id} and event type of ${eventType}`,
    );
    console.log("Webhook payload:", evt.data);
    switch (eventType) {
      case "waitlistEntry.created": {
        try {
          await inngest.send({
            name: "early-access/contact.create",
            id: `${id}-${eventType}`,
            data: {
              email: evt.data.email_address,
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
  } catch (error) {
    console.error("Error: Could not verify webhook:", error);
    return NextResponse.json({ message: "Not configured", ok: false });
  }
}
