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

export interface CreateAuthIssuerEnv {
  RESEND_API_KEY: string;
  POSTGRES_URL: string;
}

async function getUserByEmailOrCreate(
  trpc: ReturnType<typeof createTRPCPureProvider>,
  email: string,
): Promise<string> {
  try {
    const user = await trpc.tenant.user.getByEmail({ email });
    return user.id;
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      const newUser = await trpc.app.user.create({ email });
      return newUser.id;
    }
    throw error;
  }
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
          throw new Error("No email found");
        }
        const userId = await getUserByEmailOrCreate(trpc, email);
        if (!userId) {
          throw new Error("Failed to create user");
        }
        return ctx.subject(
          "account",
          { type: "email", email, id: userId },
          { subject: userId },
        );
      }
      throw new Error("Invalid provider");
    },
  });
}
