import { withRelatedProject } from '@vercel/related-projects';

// Get the playground URL dynamically based on environment
export const playgroundUrl = withRelatedProject({
  projectName: '@lightfast/playground',
  defaultHost: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:4105' 
    : 'https://playground.lightfast.ai',
});