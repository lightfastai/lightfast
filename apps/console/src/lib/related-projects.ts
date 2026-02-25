import { withRelatedProject } from '@vercel/related-projects';

const isDevelopment = process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production' && process.env.NEXT_PUBLIC_VERCEL_ENV !== 'preview';

// Get the auth URL dynamically based on environment
// Auth is served from lightfast.ai via microfrontends (not a separate subdomain)
export const authUrl = withRelatedProject({
  projectName: 'lightfast-auth',
  defaultHost: isDevelopment
    ? 'http://localhost:4104'
    : 'https://lightfast.ai',
});

// Get the www URL dynamically based on environment
export const wwwUrl = withRelatedProject({
  projectName: 'lightfast-www',
  defaultHost: isDevelopment
    ? 'http://localhost:4101'
    : 'https://lightfast.ai',
});

// Get the gateway URL dynamically based on environment
// Gateway is a standalone Hono service (not part of microfrontends)
export const gatewayUrl = withRelatedProject({
  projectName: 'lightfast-gateway',
  defaultHost: isDevelopment
    ? 'http://localhost:4108'
    : 'https://gateway.lightfast.ai',
});

// Get the connections service URL dynamically based on environment
// Connections is a standalone Hono service (not part of microfrontends)
export const connectionsUrl = withRelatedProject({
  projectName: 'lightfast-connections',
  defaultHost: isDevelopment
    ? 'http://localhost:4110'
    : 'https://connections.lightfast.ai',
});
