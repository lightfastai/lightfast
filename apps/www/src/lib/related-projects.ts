import { withRelatedProject } from '@vercel/related-projects';
import { env } from '@repo/app-urls';

const isDevelopment = env.NEXT_PUBLIC_VERCEL_ENV === 'development';

// Get the chat URL dynamically based on environment
export const chatUrl = withRelatedProject({
  projectName: 'lightfast-chat',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_CHAT_PORT}`
    : 'https://chat.lightfast.ai',
});

// Get the cloud URL dynamically based on environment
export const cloudUrl = withRelatedProject({
  projectName: 'lightfast-app',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_CLOUD_PORT}`
    : 'https://cloud.lightfast.ai',
});

// Get the auth URL dynamically based on environment
export const authUrl = withRelatedProject({
  projectName: 'lightfast-auth',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_AUTH_PORT}`
    : 'https://auth.lightfast.ai',
});

// Get the deus URL dynamically based on environment
export const deusUrl = withRelatedProject({
  projectName: 'lightfast-deus',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_DEUS_PORT}`
    : 'https://deus.lightfast.ai',
});
