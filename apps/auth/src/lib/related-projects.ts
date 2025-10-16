import { withRelatedProject } from '@vercel/related-projects';
import { env } from '@repo/app-urls';

const isDevelopment = env.NEXT_PUBLIC_VERCEL_ENV === 'development';

// Get the playground URL dynamically based on environment
export const playgroundUrl = withRelatedProject({
  projectName: 'lightfast-playground',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_PLAYGROUND_PORT}`
    : 'https://playground.lightfast.ai',
});

// Get the cloud URL dynamically based on environment
export const cloudUrl = withRelatedProject({
  projectName: 'lightfast-app',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_CLOUD_PORT}`
    : 'https://cloud.lightfast.ai',
});