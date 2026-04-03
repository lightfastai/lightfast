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
  throw new Error(`findSimilarLogic not implemented [requestId=${requestId}]`);
}
