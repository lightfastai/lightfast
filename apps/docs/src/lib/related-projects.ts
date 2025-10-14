import { withRelatedProject } from '@vercel/related-projects';
import { env } from '@/src/env';

const isDevelopment = env.NEXT_PUBLIC_VERCEL_ENV === 'development';

// Get the www URL dynamically based on environment
export const wwwUrl = withRelatedProject({
  projectName: 'lightfast-www',
  defaultHost: isDevelopment
    ? 'http://localhost:4101'
    : 'https://lightfast.ai',
});

// Get the auth URL dynamically based on environment
export const authUrl = withRelatedProject({
  projectName: 'lightfast-auth',
  defaultHost: isDevelopment
    ? 'http://localhost:4104'
    : 'https://auth.lightfast.ai',
});

// Get the cloud URL dynamically based on environment
export const cloudUrl = withRelatedProject({
  projectName: 'lightfast-app',
  defaultHost: isDevelopment
    ? 'http://localhost:4103'
    : 'https://cloud.lightfast.ai',
});

// Get the chat URL dynamically based on environment
export const chatUrl = withRelatedProject({
  projectName: 'lightfast-chat',
  defaultHost: isDevelopment
    ? 'http://localhost:4106'
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
      ? 'http://localhost:3002'
      : 'https://docs.lightfast.ai',
    playground: isDevelopment
      ? 'http://localhost:4105'
      : 'https://playground.lightfast.ai',
    deus: isDevelopment
      ? 'http://localhost:4107'
      : 'https://deus.lightfast.ai',
    experimental: isDevelopment
      ? 'http://localhost:3001'
      : 'https://experimental.lightfast.ai',
  };
}
