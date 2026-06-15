import {
  nativeClientSchema,
  nativeOAuthConfigSchema,
} from "@repo/native-auth-contract";

import { createNativeOAuthFacadeCaller } from "~/trpc/callers/oauth";
import { errorResponse, jsonResponse } from "../../_server/response";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ client: string }> }
) {
  try {
    const parsedClient = nativeClientSchema.parse((await params).client);
    const caller = await createNativeOAuthFacadeCaller({
      headers: req.headers,
      source: parsedClient,
    });
    const config = await caller.native.auth.oauthConfig({
      client: parsedClient,
    });
    return jsonResponse(nativeOAuthConfigSchema.parse(config));
  } catch (error) {
    return errorResponse(error);
  }
}
