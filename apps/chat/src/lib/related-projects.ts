import { withRelatedProject } from '@vercel/related-projects';
import { env } from '~/env';

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
