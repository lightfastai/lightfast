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

// Get the cloud URL dynamically based on environment
export const cloudUrl = withRelatedProject({
  projectName: 'lightfast-app',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_CLOUD_PORT}`
    : 'https://cloud.lightfast.ai',
});

// Get the chat URL dynamically based on environment
export const chatUrl = withRelatedProject({
  projectName: 'lightfast-chat',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_CHAT_PORT}`
    : 'https://chat.lightfast.ai',
});

// Helper for auth URLs (replicates getAuthUrls from url-config)
export function getAuthUrls() {
  return {
    signIn: `${authUrl}/sign-in`,
    signUp: `${authUrl}/sign-up`,
    afterSignIn: cloudUrl,
    afterSignUp: cloudUrl,
    afterSignOut: wwwUrl,
  };
}

// Helper for all app URLs (replicates getAllAppUrls from url-config)
export function getAllAppUrls() {
  return {
    www: wwwUrl,
    auth: authUrl,
    cloud: cloudUrl,
    chat: chatUrl,
    docs: isDevelopment
      ? `http://localhost:${env.NEXT_PUBLIC_DOCS_PORT}`
      : 'https://docs.lightfast.ai',
    playground: isDevelopment
      ? `http://localhost:${env.NEXT_PUBLIC_PLAYGROUND_PORT}`
      : 'https://playground.lightfast.ai',
    deus: isDevelopment
      ? `http://localhost:${env.NEXT_PUBLIC_DEUS_PORT}`
      : 'https://deus.lightfast.ai',
    experimental: isDevelopment
      ? `http://localhost:${env.NEXT_PUBLIC_EXPERIMENTAL_PORT}`
      : 'https://experimental.lightfast.ai',
  };
}
