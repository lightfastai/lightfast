import {
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
} from "@repo/provider-routine-contract";

import {
  createNativeProviderRoutineContext,
  errorResponse,
  jsonResponse,
  loadNativeProviderRoutineServices,
} from "../_server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const input = providerRoutineCallInputSchema.parse(
      await req.json().catch(() => null)
    );
    const context = await createNativeProviderRoutineContext(req);
    const { callProviderRoutine } = await loadNativeProviderRoutineServices();
    const result = await callProviderRoutine(context, input);
    return jsonResponse(providerRoutineCallSuccessSchema.parse(result));
  } catch (error) {
    return errorResponse(error);
  }
}
