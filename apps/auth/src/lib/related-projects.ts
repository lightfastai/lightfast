import { withRelatedProject } from '@vercel/related-projects';

const isDevelopment = process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production' && process.env.NEXT_PUBLIC_VERCEL_ENV !== 'preview';

// Get the console URL dynamically based on environment
// Console is served from lightfast.ai via microfrontends (not a separate subdomain)
export const consoleUrl = withRelatedProject({
  projectName: 'lightfast-console',
  defaultHost: isDevelopment
    ? 'http://localhost:4107'
    : 'https://lightfast.ai',
});
