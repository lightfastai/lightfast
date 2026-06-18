import {
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
} from "@lightfast/connector-core/provider-routines";
import { createFileRoute } from "@tanstack/react-router";
import {
  createNativeProviderRoutineContext,
  errorResponse,
  jsonResponse,
  loadNativeProviderRoutineServices,
} from "~/server/native-proxy";

export const Route = createFileRoute("/api/native/proxy/call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = providerRoutineCallInputSchema.parse(
            await request.json().catch(() => null)
          );
          const context = await createNativeProviderRoutineContext(request);
          const { callProviderRoutine } =
            await loadNativeProviderRoutineServices();
          const result = await callProviderRoutine(context, input);
          return jsonResponse(providerRoutineCallSuccessSchema.parse(result));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
