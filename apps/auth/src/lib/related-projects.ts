import { withRelatedProject } from '@vercel/related-projects';
import { env } from '@repo/app-urls';

const isDevelopment = env.NEXT_PUBLIC_VERCEL_ENV === 'development';

// Get the console URL dynamically based on environment
// Console is served from lightfast.ai via microfrontends (not a separate subdomain)
export const consoleUrl = withRelatedProject({
  projectName: 'lightfast-console',
  defaultHost: isDevelopment
    ? `http://localhost:${env.NEXT_PUBLIC_CONSOLE_PORT}`
    : 'https://lightfast.ai',
});
