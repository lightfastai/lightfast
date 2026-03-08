"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  ticket: z.string().optional(),
});

export async function initiateSignUp(formData: FormData) {
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    ticket: formData.get("ticket") || undefined,
  });

  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email";
    const ticketParam = formData.get("ticket")
      ? `&ticket=${encodeURIComponent(formData.get("ticket") as string)}`
      : "";
    redirect(`/sign-up?error=${encodeURIComponent(message)}${ticketParam}`);
  }

  // Email validated. Redirect to OTP step — the client island will handle
  // signUp.emailCode.sendCode() or signUp.ticket() via Clerk's FAPI.
  const ticketParam = parsed.data.ticket
    ? `&ticket=${encodeURIComponent(parsed.data.ticket)}`
    : "";
  redirect(
    `/sign-up?step=code&email=${encodeURIComponent(parsed.data.email)}${ticketParam}`
  );
}
