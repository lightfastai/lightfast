import { withRelatedProject } from '@vercel/related-projects';
import { env } from '@repo/app-urls';

const isDevelopment = env.NEXT_PUBLIC_VERCEL_ENV === 'development';

// Get the www URL dynamically based on environment
export const wwwUrl = withRelatedProject({
  projectName: 'lightfast-www',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_WWW_PORT}`
    : 'https://lightfast.ai',
});

// Get the auth URL dynamically based on environment
export const authUrl = withRelatedProject({
  projectName: 'lightfast-auth',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_AUTH_PORT}`
    : 'https://auth.lightfast.ai',
});

// Get the chat URL dynamically based on environment
export const chatUrl = withRelatedProject({
  projectName: 'lightfast-chat',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_CHAT_PORT}`
    : 'https://chat.lightfast.ai',
});

// Get the console URL dynamically based on environment
export const consoleUrl = withRelatedProject({
  projectName: 'lightfast-console',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_CONSOLE_PORT}`
    : 'https://console.lightfast.ai',
});

// Get the www-search URL dynamically based on environment
export const wwwSearchUrl = withRelatedProject({
  projectName: 'lightfast-www-search',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_WWW_SEARCH_PORT}`
    : 'https://search.lightfast.ai',
});

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
    wwwSearch: wwwSearchUrl,
    auth: authUrl,
    chat: chatUrl,
    console: consoleUrl,
    docs: isDevelopment
      ? `http://localhost:${env.NEXT_PUBLIC_DOCS_PORT}`
      : 'https://docs.lightfast.ai',
  };
}
