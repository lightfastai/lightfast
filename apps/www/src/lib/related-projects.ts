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

// Get the console URL dynamically based on environment
// Console is served from lightfast.ai via microfrontends (not a separate subdomain)
export const consoleUrl = withRelatedProject({
  projectName: 'lightfast-console',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_CONSOLE_PORT}`
    : 'https://lightfast.ai',
});
