import { Knock, signUserToken as knockSignUserToken } from "@knocklabs/node";

// Import from relative path to get the internal env configuration
import { env } from "./env";

const key = env.KNOCK_API_KEY;

/**
 * Server-side Knock client singleton.
 * Returns null if KNOCK_API_KEY is not set.
 */
export const notifications = key ? new Knock({ apiKey: key }) : null;

/**
 * Sign a user token for client-side authentication
 * Required for Knock's enhanced security mode
 */
export const signUserToken = knockSignUserToken;
