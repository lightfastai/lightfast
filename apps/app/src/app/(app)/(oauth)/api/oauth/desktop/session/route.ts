import { nativeSessionMetadataSchema } from "@repo/native-auth-contract";

import { createNativeOAuthFacadeCaller } from "~/trpc/callers/oauth";
import { errorResponse, jsonResponse } from "../../_server/response";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const caller = await createNativeOAuthFacadeCaller({
      headers: req.headers,
      source: "desktop",
    });
    const session = await caller.native.auth.session();
    return jsonResponse(nativeSessionMetadataSchema.parse(session));
  } catch (error) {
    return errorResponse(error);
  }
}
