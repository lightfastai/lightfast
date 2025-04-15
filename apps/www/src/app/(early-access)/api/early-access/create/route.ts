import { NextResponse } from "next/server";

import { arcjet, protectSignup } from "@vendor/security";

import { earlyAcessFormSchema } from "~/components/early-access/early-acesss-form.validations";
import { env } from "~/env";

export const runtime = "edge";

const CLERK_API_URL = "https://api.clerk.com/v1";

const aj = arcjet({
  key: env.ARCJET_KEY, // Get your site key from https://app.arcjet.com
  rules: [
    protectSignup({
      email: {
        mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
        // Block emails that are disposable, invalid, or have no MX records
        block: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
      },
      bots: {
        mode: "LIVE",
        // configured with a list of bots to allow from
        // https://arcjet.com/bot-list
        allow: [], // "allow none" will block all detected bots
      },
      // It would be unusual for a form to be submitted more than 5 times in 10
      // minutes from the same IP address
      rateLimit: {
        // uses a sliding window rate limit
        mode: "LIVE",
        interval: "10m", // counts requests over a 10 minute sliding window
        max: 10, // allows 5 submissions within the window
      },
    }),
  ],
});

export async function POST(request: Request) {
  const clerkSecretKey = env.CLERK_SECRET_KEY;

  try {
    const json = await request.json();
    const parsed = earlyAcessFormSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email address provided." },
        { status: 400 },
      );
    }

    const { email } = parsed.data;

    const decision = await aj.protect(request, { email });
    console.log("Arcjet decision:", decision);

    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        return NextResponse.json(
          {
            error: "Invalid email address provided.",
            message: decision.reason,
          },
          { status: 400 },
        );
      }

      if (decision.reason.isRateLimit()) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded. Please try again in 10 minutes.",
            message: decision.reason,
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          error: "Security check failed. Are you a bot?",
          message: decision.reason,
        },
        { status: 403 },
      );
    } else {
      // Directly call the Clerk Backend API
      const response = await fetch(`${CLERK_API_URL}/waitlist_entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clerkSecretKey}`,
        },
        body: JSON.stringify({ email_address: email }), // Use email_address as per Clerk API docs
      });

      const clerkResponse = await response.json();

      if (!response.ok) {
        // Log the detailed error response from Clerk for debugging
        console.error(
          `Clerk API Error (${response.status}):`,
          clerkResponse.errors || clerkResponse,
        );

        let clientErrorMessage = "Failed to add email to the waitlist.";
        const clerkError = clerkResponse.errors?.[0];

        // Map specific Clerk errors to generic messages if needed
        if (clerkError?.code === "duplicate_record") {
          // Even for duplicates, we might want to return a success-like message
          // to avoid confirming if an email is already on the list.
          // Or return a specific but still generic message like:
          // clientErrorMessage = "This email address is already registered.";
          // For now, let's treat it as a success to avoid enumeration
          return NextResponse.json(
            { success: true, message: "You're already on the list!" }, // Or just { success: true }
            { status: 200 }, // Return 200 to not indicate an error state for duplicates
          );
        } else if (response.status >= 500) {
          clientErrorMessage =
            "There was a problem connecting to the waitlist service. Please try again later.";
        } else if (response.status >= 400) {
          // Catch-all for other 4xx errors from Clerk
          clientErrorMessage =
            "There was an issue processing your request. Please check the email address and try again.";
        }

        // Return the generic error message to the client
        return NextResponse.json(
          { error: clientErrorMessage },
          { status: 500 }, // Use a generic 500 or a more appropriate status based on policy
        );
      }

      // Clerk API responded successfully (e.g., status 200)
      return NextResponse.json(
        { success: true, entry: clerkResponse },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error("API Route - Waitlist error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
