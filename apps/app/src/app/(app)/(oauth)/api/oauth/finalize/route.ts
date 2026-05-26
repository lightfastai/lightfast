import {
  nativeFinalizeRequestSchema,
  nativeSessionMetadataSchema,
} from "@repo/native-auth-contract";

import { createNativeOAuthFacadeCaller } from "~/trpc/callers/oauth";
import { errorResponse, jsonResponse } from "../_server/response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = nativeFinalizeRequestSchema.parse(
      await req.json().catch(() => null)
    );
    const caller = await createNativeOAuthFacadeCaller({
      headers: req.headers,
      source: body.client,
    });
    const session = await caller.native.auth.finalize(body);
    return jsonResponse(nativeSessionMetadataSchema.parse(session));
  } catch (error) {
    return errorResponse(error);
  }
}
