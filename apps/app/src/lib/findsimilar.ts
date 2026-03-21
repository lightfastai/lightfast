import type {
  FindSimilarRequest,
  FindSimilarResponse,
} from "@repo/app-validation";
import type { AuthContext } from "./types";

export async function findSimilarLogic(
  _auth: AuthContext,
  _input: FindSimilarRequest,
  requestId: string
): Promise<FindSimilarResponse> {
  // TODO: Implement with Pinecone similarity search
  // Refer to thoughts/shared/research/2026-03-13-v2-route-implementation-research.md
  throw new Error(`findSimilarLogic not implemented [requestId=${requestId}]`);
}
