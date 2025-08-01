/**
 * Server utility functions
 */

import { uuidv4 } from "../utils/uuid";

// Generate session IDs using UUID v4
export const generateSessionId = () => uuidv4();
