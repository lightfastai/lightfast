"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { serializeSignInParams } from "../_lib/search-params";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

function getRedirectUrl(formData: FormData): string | null {
  const value = formData.get("redirect_url");
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function initiateSignIn(formData: FormData) {
  const redirectUrl = getRedirectUrl(formData);
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email";
    redirect(
      serializeSignInParams("/sign-in", {
        error: message,
        redirect_url: redirectUrl,
      })
    );
  }

  // Email validated. Redirect to OTP step — the client island will call
  // signIn.emailCode.sendCode() via Clerk's FAPI.
  redirect(
    serializeSignInParams("/sign-in", {
      step: "code",
      email: parsed.data.email,
      redirect_url: redirectUrl,
    })
  );
}
