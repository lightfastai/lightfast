import { issuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { CodeUI } from "@openauthjs/openauth/ui/code";

import { emailConfig } from "@repo/lightfast-config";
import { sendResendEmailSafe } from "@repo/lightfast-email/functions";
import { CodeEmail, codeEmailText } from "@repo/lightfast-email/templates";

import { authSubjects } from "./subjects";

function getUser(email: string) {
  // Get user from database and return user ID
  // This is a placeholder. In a real app, you would query your database.
  console.log(`Fetching user ID for email: ${email}`);
  return "123"; // Placeholder user ID
}

export default issuer({
  subjects: authSubjects,
  storage: MemoryStorage(),
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
            from: emailConfig.auth,
            to: email,
            subject: "Your Lightfast.ai sign-in code",
            text: codeEmailText({ code }),
            react: CodeEmail({ email, code }),
          });

          if (result.isErr()) {
            console.error("Failed to send email:", result.error);
            // Handle error appropriately - maybe throw or log to an error service
            // For now, we'll just log it. Depending on requirements, you might
            // want to inform the user or retry.
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

      return ctx.subject(
        "account",
        { type: "email", email },
        { subject: email },
      );
    }

    throw new Error("Invalid provider");
  },
});
