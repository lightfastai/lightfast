/**
 * Vercel project configuration for Related Projects feature
 */

export const VERCEL_PROJECT_IDS = {
  www: process.env.VERCEL_PROJECT_ID_WWW || "prj_JRXRxBruTvB5Bs99JjA63TLek6GT",
  auth: process.env.VERCEL_PROJECT_ID_AUTH || "prj_PBHuC98wYesWVlTqMMwLg1Cm7pui",
  cloud: process.env.VERCEL_PROJECT_ID_CLOUD || "prj_n3D3MPJlt9DX9OSAVpJYXFb1pGBc",
  chat: process.env.VERCEL_PROJECT_ID_CHAT || "prj_PLACEHOLDER_CHAT",
  docs: process.env.VERCEL_PROJECT_ID_DOCS || "prj_PLACEHOLDER_DOCS",
  playground: process.env.VERCEL_PROJECT_ID_PLAYGROUND || "prj_PLACEHOLDER_PLAYGROUND",
  deus: process.env.VERCEL_PROJECT_ID_DEUS || "prj_PLACEHOLDER_DEUS",
} as const;

export type ProjectName = keyof typeof VERCEL_PROJECT_IDS;

/**
 * Get project ID for a given project name
 */
export function getProjectId(projectName: ProjectName): string {
  return VERCEL_PROJECT_IDS[projectName];
}

/**
 * Check if running in Vercel environment
 */
export function isVercel(): boolean {
  return process.env.VERCEL === "1";
}

/**
 * Get current deployment URL in Vercel
 */
export function getDeploymentUrl(): string | undefined {
  // Vercel provides these environment variables
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return undefined;
}

/**
 * Get branch-specific URL
 */
export function getBranchUrl(projectName: ProjectName): string | undefined {
  if (!isVercel()) return undefined;
  
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  if (!branch) return undefined;
  
  // Format: project-branch.vercel.app
  const projectId = getProjectId(projectName);
  const safeBranch = branch.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return `https://${projectId}-${safeBranch}.vercel.app`;
}