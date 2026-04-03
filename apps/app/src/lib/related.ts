import type { RelatedRequest, RelatedResponse } from "@repo/app-validation";
import type { AuthContext } from "./types";

export async function relatedLogic(
  _auth: AuthContext,
  _input: RelatedRequest,
  requestId: string
): Promise<RelatedResponse> {
  // TODO: Implement with BFS graph traversal
  throw new Error(`relatedLogic not implemented [requestId=${requestId}]`);
}
