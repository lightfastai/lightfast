import { withRelatedProject } from '@vercel/related-projects';
import { getAppUrl } from '@repo/url-utils';

// Get the playground URL dynamically based on environment
export const playgroundUrl = withRelatedProject({
  projectName: 'lightfast-playground',
  defaultHost: getAppUrl('playground'),
});

// Get the auth URL dynamically based on environment
export const authUrl = withRelatedProject({
  projectName: 'lightfast-auth',
  defaultHost: getAppUrl('auth'),
});