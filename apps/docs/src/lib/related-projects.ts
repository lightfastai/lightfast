import { env } from '@repo/app-urls';

const isDevelopment = env.NEXT_PUBLIC_VERCEL_ENV === 'development';

// Get the www URL dynamically based on environment
export const wwwUrl = isDevelopment
  ? `http://localhost:${env.NEXT_PUBLIC_WWW_PORT}`
  : 'https://lightfast.ai';

// Get the auth URL dynamically based on environment
// Auth is served from lightfast.ai via microfrontends (not a separate subdomain)
export const authUrl = isDevelopment
  ? `http://localhost:${env.NEXT_PUBLIC_AUTH_PORT}`
  : 'https://lightfast.ai';

// Get the chat URL dynamically based on environment
export const chatUrl = isDevelopment
  ? `http://localhost:${env.NEXT_PUBLIC_CHAT_PORT}`
  : 'https://chat.lightfast.ai';

// Get the console URL dynamically based on environment
// Console is served from lightfast.ai via microfrontends (not a separate subdomain)
export const consoleUrl = isDevelopment
  ? `http://localhost:${env.NEXT_PUBLIC_CONSOLE_PORT}`
  : 'https://lightfast.ai';

// Helper for auth URLs (replicates getAuthUrls from url-config)
export function getAuthUrls() {
  return {
    signIn: `${authUrl}/sign-in`,
    signUp: `${authUrl}/sign-up`,
    afterSignIn: consoleUrl,
    afterSignUp: consoleUrl,
    afterSignOut: wwwUrl,
  };
}

// Helper for all app URLs (replicates getAllAppUrls from url-config)
export function getAllAppUrls() {
  return {
    www: wwwUrl,
    auth: authUrl,
    chat: chatUrl,
    console: consoleUrl,
    docs: isDevelopment
      ? `http://localhost:${env.NEXT_PUBLIC_DOCS_PORT}`
      : 'https://docs.lightfast.ai',
  };
}
