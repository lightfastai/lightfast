import type {
  ContentsRequest,
  ContentsResponse,
} from "@repo/console-validation";
import type { AuthContext } from "./types";

export async function contentsLogic(
  _auth: AuthContext,
  _input: ContentsRequest,
  requestId: string
): Promise<ContentsResponse> {
  // TODO: Implement with DB lookup (doc_* and obs_* ID split)
  // Refer to thoughts/shared/research/2026-03-13-v2-route-implementation-research.md
  throw new Error(`contentsLogic not implemented [requestId=${requestId}]`);
}
