import { env } from "./env";

/**
 * Get the docs app URL based on environment
 * - Development: localhost with port from env
 * - Production/Preview: Vercel deployment URL
 */
export function getDocsUrl(): string {
  // In production or preview on Vercel, use the deployed URL
  if (
    env.NEXT_PUBLIC_VERCEL_ENV === "production" ||
    env.NEXT_PUBLIC_VERCEL_ENV === "preview" ||
    process.env.NODE_ENV === "production"
  ) {
    return "https://lightfast-docs.vercel.app";
  }
  // Local development
  return `http://localhost:${env.NEXT_PUBLIC_DOCS_PORT}`;
}

export { env };
