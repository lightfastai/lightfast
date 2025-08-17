import { serve } from "inngest/next";
import { inngest } from "~/inngest/client";
import { generateSessionTitle } from "~/inngest/functions/generate-session-title";

// Create the Inngest route handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateSessionTitle,
    // Add more functions here as needed
  ],
});