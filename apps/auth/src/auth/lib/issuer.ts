import type { StorageAdapter } from "@openauthjs/openauth/storage/storage";
import { issuer as OpenAuthIssuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { CodeUI } from "@openauthjs/openauth/ui/code";
import { TRPCError } from "@trpc/server";

import { emailConfig } from "@repo/lightfast-config";
import { sendResendEmailSafe } from "@repo/lightfast-email/functions";
import { CodeEmail, codeEmailText } from "@repo/lightfast-email/templates";
import { createTRPCPureProvider } from "@repo/trpc-client/trpc-pure-server-provider";
import { createEmailClient } from "@vendor/email";
import { authSubjects } from "@vendor/openauth";

import {
  getOrCreateUserSafe,
  UserCreationConflictError,
  UserCreationError,
  UserFetchError,
  UserIndeterminateStateError,
  UserNotFoundError,
  UserUnknownError,
} from "./user-operations";

export interface CreateAuthIssuerEnv {
  RESEND_API_KEY: string;
  POSTGRES_URL: string;
}

export function createAuthIssuer({
  env,
  storage,
}: {
  env: CreateAuthIssuerEnv;
  storage: StorageAdapter;
}) {
  const emailClient = createEmailClient(env.RESEND_API_KEY);
  const trpc = createTRPCPureProvider(env.POSTGRES_URL);

  return OpenAuthIssuer({
    subjects: authSubjects,
    storage,
    allow: async () => true,
    providers: {
      email: CodeProvider(
        CodeUI({
          sendCode: async (claims, code) => {
            const { email } = claims;
            if (!email) {
              throw new Error("Email is required");
            }
            console.log(`Sending code ${code} to email: ${email}`);
            const result = await sendResendEmailSafe({
              client: emailClient,
              from: emailConfig.auth,
              to: email,
              subject: "Your Lightfast.ai sign-in code",
              text: codeEmailText({ code }),
              react: CodeEmail({ email, code }),
            });
            if (result.isErr()) {
              console.error("Failed to send email:", result.error);
            } else {
              console.log("Email sent successfully, ID:", result.value.id);
            }
          },
        }),
      ),
    },
    success: async (ctx, value) => {
      if (value.provider === "email") {
        const email = value.claims.email;
        if (!email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No email found in claims",
          });
        }

        const userResult = await getOrCreateUserSafe(trpc, email);

        if (userResult.isErr()) {
          const error = userResult.error;
          console.error(
            `Failed to get or create user for email ${email}:`,
            error,
          );

          // Map specific errors to TRPCError codes
          if (
            error instanceof UserNotFoundError ||
            error instanceof UserCreationConflictError
          ) {
            // These cases are handled internally by getOrCreateUserSafe,
            // so if they propagate here, it's an unexpected state.
            // Logically, getOrCreateUserSafe should always return a user or a more generic error.
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Unexpected error state after user operation: ${error.message}`,
              cause: error,
            });
          }
          if (
            error instanceof UserCreationError ||
            error instanceof UserFetchError
          ) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Failed to process user: ${error.message}`,
              cause: error.cause,
            });
          }
          if (error instanceof UserIndeterminateStateError) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: error.message,
              cause: error,
            });
          }
          if (error instanceof UserUnknownError) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "An unknown error occurred while processing user data.",
              cause: error.cause,
            });
          }

          // Fallback for any other UserOperationError type not explicitly handled
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred during user processing.",
            cause: error,
          });
        }

        const user = userResult.value;
        const userId = user.id;

        if (!userId) {
          // This should not be reached if getOrCreateUserSafe guarantees a user object with an id on success.
          // And UserIndeterminateStateError should have been caught above.
          console.error(
            `User ID is missing for ${email} after successful get/create.`,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "User ID was not determined after get/create process.",
          });
        }

        return ctx.subject(
          "account",
          { type: "email", email, id: userId },
          { subject: userId },
        );
      }
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid provider" });
    },
  });
}
