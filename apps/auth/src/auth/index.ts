import { issuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { CodeUI } from "@openauthjs/openauth/ui/code";

import { sendEmail } from "../lib/email"; // Assuming this will be resolved
import CodeEmail, { codeEmailText } from "../templates/code-email";
import { subjects } from "./subjects";

// Adjusted path for www

function getUser(email: string) {
  // Get user from database and return user ID
  // This is a placeholder. In a real app, you would query your database.
  console.log(`Fetching user ID for email: ${email}`);
  return "123"; // Placeholder user ID
}

export default issuer({
  subjects,
  storage: MemoryStorage(),
  providers: {
    code: CodeProvider(
      CodeUI({
        sendCode: async (claims, code) => {
          const { email } = claims;

          if (!email) {
            throw new Error("Email is required");
          }

          console.log(`Sending code ${code} to email: ${email}`);

          const result = await sendEmail({
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
    if (value.provider === "code") {
      if (!value.claims.email) {
        // This case should ideally not happen if email is required by the provider
        console.error("Email claim is missing in provider response");
        throw new Error("Email not found in claims after code verification.");
      }
      return ctx.subject("user", {
        id: await getUser(value.claims.email), // Email is now guaranteed to be a string
      });
    }
    console.error(
      "Invalid provider encountered in success callback:",
      value.provider,
    );
    throw new Error("Invalid provider");
  },
});
