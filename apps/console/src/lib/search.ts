import type {
  SearchRequest,
  SearchResponse,
} from "@repo/console-validation";
import type { AuthContext } from "./types";

export async function searchLogic(
  _auth: AuthContext,
  _input: SearchRequest,
  requestId: string
): Promise<SearchResponse> {
  // TODO: Implement with Pinecone vector search
  // Refer to thoughts/shared/research/2026-03-13-v2-route-implementation-research.md
  throw new Error(`searchLogic not implemented [requestId=${requestId}]`);
}
