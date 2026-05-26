"use server";

import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createNativeAuthCaller } from "~/app/api/native-auth/_server/native-auth-caller";
import {
  nativeCreateAttemptFormSchema,
  toCreateAttemptInput,
} from "./validators";

export async function continueNativeAuth(formData: FormData) {
  const parsed = nativeCreateAttemptFormSchema.parse(
    Object.fromEntries(formData)
  );
  const input = toCreateAttemptInput(parsed);
  const caller = await createNativeAuthCaller({
    headers: await headers(),
    source: input.client,
  });
  const result = await caller.native.auth.createAttempt(input);
  redirect(result.authorizationUrl as Route);
}
