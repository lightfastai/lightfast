import type { EvalWorkspaceConfig } from "../types";

export type { EvalInfraConfig, EvalWorkspaceConfig, EvalContext } from "../types";

/**
 * Safety guard: validate that eval config does NOT point to production.
 * Checks namespace prefix and workspace ID prefix.
 * Three layers of defense:
 *   1. PlanetScale branch-scoped passwords (physical isolation)
 *   2. Pinecone namespace prefix enforcement (this function)
 *   3. Workspace ID prefix enforcement (this function)
 */
export function assertEvalSafety(workspace: EvalWorkspaceConfig): void {
  if (!workspace.namespaceName.startsWith("eval:")) {
    throw new Error(
      `SAFETY: Eval namespace must start with "eval:" prefix. ` +
        `Got: "${workspace.namespaceName}". ` +
        `This prevents accidental writes to production Pinecone namespaces.`,
    );
  }

  if (!workspace.workspaceId.startsWith("eval_")) {
    throw new Error(
      `SAFETY: Eval workspaceId must start with "eval_" prefix. ` +
        `Got: "${workspace.workspaceId}". ` +
        `This prevents accidental queries against production workspace data.`,
    );
  }
}
