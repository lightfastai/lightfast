import { customAlphabet } from "nanoid";

// Full alphanumeric: 0-9, a-z, A-Z (62 characters)
// Used for IDs and API key secrets
export const nanoid = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
);
