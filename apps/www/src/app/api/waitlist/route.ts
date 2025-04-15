import { NextResponse } from "next/server";

import { waitlistFormSchema } from "~/app/validations/valid-email";
import { env } from "~/env";

export const runtime = "edge";

const CLERK_API_URL = "https://api.clerk.com/v1";

export async function POST(request: Request) {
  const clerkSecretKey = env.CLERK_SECRET_KEY;

  try {
    const json = await request.json();
    const parsed = waitlistFormSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email address provided." },
        { status: 400 },
      );
    }

    const { email } = parsed.data;

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
      // Log the error response from Clerk for debugging
      console.error(
        `Clerk API Error (${response.status}):`,
        clerkResponse.errors || clerkResponse,
      );
      // Try to use the error message from Clerk if available
      const errorMessage =
        clerkResponse.errors?.[0]?.message ||
        `Failed to add to waitlist via Clerk API (Status: ${response.status})`;
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }, // Return Clerk's error status
      );
    }

    // Clerk API responded successfully (e.g., status 200)
    return NextResponse.json(
      { success: true, entry: clerkResponse },
      { status: 200 },
    );
  } catch (error) {
    console.error("API Route - Waitlist error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
