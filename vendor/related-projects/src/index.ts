/**
 * @vendor/related-projects
 *
 * Vendor abstraction for @vercel/related-projects SDK.
 *
 * Resolves cross-project URLs on Vercel using the Related Projects
 * environment variables that Vercel injects at build/runtime.
 *
 * @example
 * ```typescript
 * import { withRelatedProject } from "@vendor/related-projects";
 *
 * const gatewayUrl = withRelatedProject({
 *   projectName: "lightfast-gateway",
 *   defaultHost: "http://localhost:4108",
 * });
 * ```
 */

export { withRelatedProject } from "@vercel/related-projects";
export type {
  RelatedProjectsOptions,
  VercelRelatedProject,
  VercelRelatedProjects,
} from "@vercel/related-projects";
