import type {
  RelatedRequest,
  RelatedResponse,
} from "@repo/console-validation";
import type { AuthContext } from "./types";

export async function relatedLogic(
  _auth: AuthContext,
  _input: RelatedRequest,
  requestId: string
): Promise<RelatedResponse> {
  // TODO: Implement with BFS graph traversal
  // Refer to thoughts/shared/research/2026-03-13-v2-route-implementation-research.md
  throw new Error(`relatedLogic not implemented [requestId=${requestId}]`);
}
