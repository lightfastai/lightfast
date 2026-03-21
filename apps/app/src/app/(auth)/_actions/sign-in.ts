"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { serializeSignInParams } from "../_lib/search-params";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function initiateSignIn(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email";
    redirect(serializeSignInParams("/sign-in", { error: message }));
  }

  // Email validated. Redirect to OTP step — the client island will call
  // signIn.emailCode.sendCode() via Clerk's FAPI.
  redirect(
    serializeSignInParams("/sign-in", {
      step: "code",
      email: parsed.data.email,
    })
  );
}
