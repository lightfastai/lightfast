import { withRelatedProject } from '@vercel/related-projects';

const isDevelopment = process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production' && process.env.NEXT_PUBLIC_VERCEL_ENV !== 'preview';

// Get the www URL dynamically based on environment
export const wwwUrl = withRelatedProject({
  projectName: 'lightfast-www',
  defaultHost: isDevelopment
    ? 'http://localhost:4101'
    : 'https://lightfast.ai',
});

// Get the auth URL dynamically based on environment
// Auth is served from lightfast.ai via microfrontends (not a separate subdomain)
export const authUrl = withRelatedProject({
  projectName: 'lightfast-auth',
  defaultHost: isDevelopment
    ? 'http://localhost:4104'
    : 'https://lightfast.ai',
});
