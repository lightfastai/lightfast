import type { CreateEmailOptions } from "resend";
import { Resend } from "resend";

import { env } from "./env";

export * from "./env";

// Initialize Resend client with API key from environment
const resend = new Resend(env.RESEND_API_KEY);

/**
/**
 * Send an email using Resend
 * @param options Email options including from, to, subject, and content
 * @returns Promise with the send result
 */
export async function sendEmail(options: CreateEmailOptions) {
  try {
    const result = await resend.emails.send(options);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error };
  }
}

// Export the Resend instance for advanced usage if needed
export { resend };
