import { withRelatedProject } from '@vercel/related-projects';
import { env } from '~/env';

const isDevelopment = env.NEXT_PUBLIC_VERCEL_ENV === 'development';

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
