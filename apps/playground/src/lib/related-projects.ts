import { withRelatedProject } from '@vercel/related-projects';

// Get the main app URL dynamically based on environment
export const appUrl = withRelatedProject({
  projectName: '@lightfast/app',
  defaultHost: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:4103' 
    : 'https://app.lightfast.ai',
});