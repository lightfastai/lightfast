/**
 * Vercel API Response Types
 * @see https://vercel.com/docs/rest-api/reference/endpoints/projects
 */

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
  createdAt: number;
  latestDeployments?: {
    id: string;
    url: string;
    createdAt: number;
    readyState: string;
  }[];
  targets?: {
    production?: {
      alias?: string[];
    };
  };
}

export interface VercelProjectsResponse {
  projects: VercelProject[];
  pagination: {
    count: number;
    next: string | null;
    prev: string | null;
  };
}

export interface VercelProjectForUI {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
  isConnected: boolean;
}
