import { serve } from "inngest/next";
import { env } from "@/env";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Create an API route handler for Inngest
export const { GET, POST, PUT } = serve({
	client: inngest,
	functions: functions,
	signingKey: env.INNGEST_SIGNING_KEY,
});
