"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { serializeSignUpParams } from "../_lib/search-params";

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
    const rawTicket = (formData.get("ticket") as string | null) ?? undefined;
    redirect(
      serializeSignUpParams("/sign-up", {
        error: message,
        ticket: rawTicket ?? null,
      }),
    );
  }

  // Email validated. Redirect to OTP step — the client island will handle
  // signUp.emailCode.sendCode() or signUp.ticket() via Clerk's FAPI.
  redirect(
    serializeSignUpParams("/sign-up", {
      step: "code",
      email: parsed.data.email,
      ticket: parsed.data.ticket ?? null,
    }),
  );
}
