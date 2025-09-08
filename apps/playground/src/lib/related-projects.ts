import { withRelatedProject } from '@vercel/related-projects';

// Get the main app URL dynamically based on environment
export const cloudUrl = withRelatedProject({
  projectName: 'lightfast-app',
  defaultHost: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:4103' 
    : 'https://cloud.lightfast.ai',
});

// Get the auth URL dynamically based on environment
export const authUrl = withRelatedProject({
  projectName: 'lightfast-auth',
  defaultHost: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:4104' 
    : 'https://auth.lightfast.ai',
});