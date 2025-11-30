import { env } from "@repo/app-urls";

const isDevelopment = env.NEXT_PUBLIC_VERCEL_ENV === "development";

// Get the www URL dynamically based on environment
export const wwwUrl = isDevelopment
  ? `http://localhost:${env.NEXT_PUBLIC_WWW_PORT}`
  : "https://lightfast.ai";

// Get the auth URL dynamically based on environment
// Auth is served from lightfast.ai via microfrontends (not a separate subdomain)
export const authUrl = isDevelopment
  ? `http://localhost:${env.NEXT_PUBLIC_AUTH_PORT}`
  : "https://lightfast.ai";

