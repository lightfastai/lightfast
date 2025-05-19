import { issuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { CodeUI } from "@openauthjs/openauth/ui/code";
import { TRPCError } from "@trpc/server";

import type { RouterOutputs } from "@vendor/trpc";
import { trpc } from "@repo/trpc-client/trpc-pure-server-provider";
import { authSubjects } from "@vendor/openauth/server";

async function getUserByEmailOrCreate(
  email: string,
): Promise<RouterOutputs["tenant"]["user"]["getByEmail"]["id"]> {
  // find user. if does not exist, create user
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

export default issuer({
  subjects: authSubjects,
  storage: MemoryStorage(),
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
          //   from: emailConfig.auth,
          //   to: email,
          //   subject: "Your Lightfast.ai sign-in code",
          //   text: codeEmailText({ code }),
          //   react: CodeEmail({ email, code }),
          // });

          // if (result.isErr()) {
          //   console.error("Failed to send email:", result.error);
          //   // Handle error appropriately - maybe throw or log to an error service
          //   // For now, we'll just log it. Depending on requirements, you might
          //   // want to inform the user or retry.
          // } else {
          //   console.log("Email sent successfully, ID:", result.value.id);
          // }
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

      const userId = await getUserByEmailOrCreate(email);

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
