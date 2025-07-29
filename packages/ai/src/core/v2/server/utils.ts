/**
 * Server utility functions
 */

import { customAlphabet } from "nanoid";

// Generate 6-digit numeric session IDs (as shown in Upstash blog)
export const generateSessionId = customAlphabet("0123456789", 6);
