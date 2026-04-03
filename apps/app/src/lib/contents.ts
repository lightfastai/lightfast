import type { ContentsRequest, ContentsResponse } from "@repo/app-validation";
import type { AuthContext } from "./types";

export async function contentsLogic(
  _auth: AuthContext,
  _input: ContentsRequest,
  requestId: string
): Promise<ContentsResponse> {
  // TODO: Implement with DB lookup (doc_* and obs_* ID split)
  throw new Error(`contentsLogic not implemented [requestId=${requestId}]`);
}
