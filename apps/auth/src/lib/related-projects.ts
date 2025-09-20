import { withRelatedProject } from '@vercel/related-projects';
import { getAppUrl } from '@repo/url-utils';

// Get the playground URL dynamically based on environment
export const playgroundUrl = withRelatedProject({
  projectName: 'lightfast-playground',
  defaultHost: getAppUrl('playground'),
});

// Get the cloud URL dynamically based on environment
export const cloudUrl = withRelatedProject({
  projectName: 'lightfast-app',
  defaultHost: getAppUrl('cloud'),
});