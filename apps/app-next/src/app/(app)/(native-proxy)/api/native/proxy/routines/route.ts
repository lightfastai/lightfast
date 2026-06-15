import {
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
} from "@repo/provider-routine-contract";

import {
  createNativeProviderRoutineContext,
  errorResponse,
  jsonResponse,
  loadNativeProviderRoutineServices,
} from "../_server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const input = providerRoutineFindInputSchema.parse({
      includeSchema:
        searchParams.get("includeSchema") === "true" ? true : undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
      provider: searchParams.get("provider") ?? undefined,
      query: searchParams.get("query") ?? undefined,
      readOnly: searchParams.get("readOnly") === "true" ? true : undefined,
      routineId: searchParams.get("routineId") ?? undefined,
    });
    const context = await createNativeProviderRoutineContext(req);
    const { findProviderRoutines } = await loadNativeProviderRoutineServices();
    const result = await findProviderRoutines(context, input);
    return jsonResponse(providerRoutineFindOutputSchema.parse(result));
  } catch (error) {
    return errorResponse(error);
  }
}
