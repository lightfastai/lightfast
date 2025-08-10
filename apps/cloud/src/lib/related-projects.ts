import { withRelatedProject } from '@vercel/related-projects';
import { env } from '../env';

// Get the playground URL dynamically based on environment
export const playgroundUrl = withRelatedProject({
  projectName: 'lightfast-playground',
  defaultHost: env.NODE_ENV === 'development' 
    ? 'http://localhost:4105' 
    : 'https://playground.lightfast.ai',
});