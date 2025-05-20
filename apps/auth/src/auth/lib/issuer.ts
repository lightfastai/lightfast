import type { StorageAdapter } from "@openauthjs/openauth/storage/storage";
import { issuer as OpenAuthIssuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { CodeUI } from "@openauthjs/openauth/ui/code";

import { createTRPCPureProvider } from "@repo/trpc-client/trpc-pure-server-provider";
import { createEmailClient } from "@vendor/email";
import { authSubjects } from "@vendor/openauth";

import {
  createUserSafe,
  fetchUserByEmailSafe,
  UserCreationConflictError,
  UserCreationError,
  UserNotFoundError,
  UserUnknownError,
} from "./functions/all";
import {
  AuthConfigurationError,
  AuthenticationProcessError,
  AuthUserConflictResolutionError,
  AuthUserCreationError,
  AuthUserRetrievalError,
} from "./functions/errors";

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
            // const result = await sendResendEmailSafe({
            //   client: emailClient,
            //   from: emailConfig.auth,
            //   to: email,
            //   subject: "Your Lightfast.ai sign-in code",
            //   text: codeEmailText({ code }),
            //   react: CodeEmail({ email, code }),
            // });
            // if (result.isErr()) {
            //   console.error("Failed to send email:", result.error);
            // } else {
            //   console.log("Email sent successfully, ID:", result.value.id);
            // }
          },
        }),
      ),
    },
    success: async (ctx, value) => {
      if (value.provider !== "email") {
        console.error(
          "Invalid provider in OpenAuth success handler:",
          value.provider,
        );
        throw new AuthConfigurationError(
          "Authentication failed: Invalid provider.",
        );
      }

      const email = value.claims.email;
      if (!email) {
        console.error("No email found in claims in OpenAuth success handler");
        throw new AuthConfigurationError(
          "Authentication failed: Email is missing.",
        );
      }

      // Attempt 1: Fetch existing user
      console.log(`Fetching user by email: ${email}`);
      const initialFetchResult = await fetchUserByEmailSafe(trpc, email);
      if (initialFetchResult.isOk()) {
        console.log(`User found for email: ${email}`);
        const user = initialFetchResult.value;
        return ctx.subject(
          "account",
          { type: "email", email: user.email, id: user.id },
          { subject: user.id },
        );
      }
      console.log(`User not found for email: ${email}`);

      const fetchError = initialFetchResult.error;
      if (!(fetchError instanceof UserNotFoundError)) {
        console.error(
          `User operation failed (initial fetch) for ${email}:`,
          fetchError,
        );
        throw new AuthUserRetrievalError(
          "Authentication failed: Could not retrieve user information.",
          fetchError,
        );
      }

      const createResult = await createUserSafe(trpc, email);
      if (createResult.isOk()) {
        const newUser = createResult.value;
        return ctx.subject(
          "account",
          { type: "email", email: newUser.email, id: newUser.id },
          { subject: newUser.id },
        );
      }

      const createError = createResult.error;
      if (createError instanceof UserCreationConflictError) {
        console.warn(
          `User creation conflict for ${email}, attempting to re-fetch.`,
          createError,
        );
        const finalFetchResult = await fetchUserByEmailSafe(trpc, email);
        if (finalFetchResult.isOk()) {
          const conflictedUser = finalFetchResult.value;
          return ctx.subject(
            "account",
            {
              type: "email",
              email: conflictedUser.email,
              id: conflictedUser.id,
            },
            { subject: conflictedUser.id },
          );
        }
        const finalFetchError = finalFetchResult.error;
        console.error(
          `User operation failed (final fetch after conflict) for ${email}:`,
          finalFetchError,
        );
        throw new AuthUserConflictResolutionError(
          "Authentication failed: Could not confirm user identity after conflict.",
          finalFetchError,
        );
      }

      console.error(
        `User operation failed (creation) for ${email}:`,
        createError,
      );
      // Distinguish between known creation errors and truly unknown ones if necessary
      if (
        createError instanceof UserCreationError ||
        createError instanceof UserUnknownError
      ) {
        throw new AuthUserCreationError(
          "Authentication failed: Could not create user account.",
          createError,
        );
      }
      // Fallback for any other type of error from createUserSafe not explicitly handled above
      throw new AuthenticationProcessError(
        "Authentication failed: An unexpected error occurred during user processing.",
        createError,
      );
    },
  });
}
