import { customAlphabet } from "nanoid";

// Custom nanoid with lowercase alphanumeric only for clean URLs
// Length 21 gives us ~149 years to have 1% probability of collision at 1000 IDs/hour
export const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 21);
