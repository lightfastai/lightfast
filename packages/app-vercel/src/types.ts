/**
 * Vercel API Response Types
 * @see https://vercel.com/docs/rest-api/reference/endpoints/projects
 */

export interface VercelProject {
  createdAt: number;
  framework: string | null;
  id: string;
  latestDeployments?: {
    id: string;
    url: string;
    createdAt: number;
    readyState: string;
  }[];
  name: string;
  targets?: {
    production?: {
      alias?: string[];
    };
  };
  updatedAt: number;
}

export interface VercelProjectsResponse {
  pagination: {
    count: number;
    next: string | null;
    prev: string | null;
  };
  projects: VercelProject[];
}

export interface VercelProjectForUI {
  framework: string | null;
  id: string;
  isConnected: boolean;
  name: string;
  updatedAt: number;
}
