import { env } from "~/env";

const isDevelopment =
  env.NEXT_PUBLIC_VERCEL_ENV !== "production" &&
  env.NEXT_PUBLIC_VERCEL_ENV !== "preview";

// Get the www URL dynamically based on environment
export const wwwUrl = isDevelopment
  ? "http://localhost:4101"
  : "https://lightfast.ai";

// Get the console URL dynamically based on environment
// Auth routes (/sign-in, /sign-up) are served by the console app
export const consoleUrl = isDevelopment
  ? "http://localhost:4107"
  : "https://lightfast.ai";
