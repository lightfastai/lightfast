"use server";

import { captureException } from "@sentry/nextjs";
import { isClerkAPIResponseError } from "@vendor/clerk";
import { clerkClient } from "@vendor/clerk/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const passwordSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

export async function signInWithPassword(formData: FormData) {
  const parsed = passwordSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(
      `/sign-in?step=password&error=${encodeURIComponent("Invalid credentials")}`
    );
  }

  try {
    const client = await clerkClient();

    // 1. Find user by email
    const users = await client.users.getUserList({
      emailAddress: [parsed.data.identifier],
    });
    const user = users.data[0];
    if (!user) {
      redirect(
        `/sign-in?step=password&error=${encodeURIComponent("Account not found")}`
      );
    }

    // 2. Verify password server-side (never touches client)
    await client.users.verifyPassword({
      userId: user.id,
      password: parsed.data.password,
    });

    // 3. Mint a short-lived sign-in token
    const { token } = await client.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: 60,
    });

    // 4. Redirect to session activator (thin client island)
    redirect(`/sign-in?step=activate&token=${token}`);
  } catch (err) {
    // redirect() throws — let it propagate
    if (err instanceof Error && err.message === "NEXT_REDIRECT") {
      throw err;
    }

    if (isClerkAPIResponseError(err)) {
      const code = err.errors[0]?.code;
      if (code === "user_locked") {
        redirect(
          `/sign-in?step=password&error=${encodeURIComponent("Account locked. Please try again later.")}`
        );
      }
      if (code === "too_many_requests" || err.status === 429) {
        redirect(
          `/sign-in?step=password&error=${encodeURIComponent("Too many attempts. Please wait and try again.")}`
        );
      }
      const message =
        err.errors[0]?.longMessage ??
        err.errors[0]?.message ??
        "Invalid email or password";
      redirect(`/sign-in?step=password&error=${encodeURIComponent(message)}`);
    }

    captureException(err);
    redirect(
      `/sign-in?step=password&error=${encodeURIComponent("An unexpected error occurred")}`
    );
  }
}
