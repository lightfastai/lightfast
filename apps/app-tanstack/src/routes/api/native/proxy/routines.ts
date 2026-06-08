import {
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
} from "@repo/provider-routine-contract";
import { createFileRoute } from "@tanstack/react-router";
import {
  createNativeProviderRoutineContext,
  errorResponse,
  jsonResponse,
  loadNativeProviderRoutineServices,
} from "~/server/native-proxy";

export const Route = createFileRoute("/api/native/proxy/routines")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const searchParams = new URL(request.url).searchParams;
          const input = providerRoutineFindInputSchema.parse({
            includeSchema:
              searchParams.get("includeSchema") === "true" ? true : undefined,
            limit: searchParams.get("limit")
              ? Number(searchParams.get("limit"))
              : undefined,
            provider: searchParams.get("provider") ?? undefined,
            query: searchParams.get("query") ?? undefined,
            readOnly:
              searchParams.get("readOnly") === "true" ? true : undefined,
            routineId: searchParams.get("routineId") ?? undefined,
          });
          const context = await createNativeProviderRoutineContext(request);
          const { findProviderRoutines } =
            await loadNativeProviderRoutineServices();
          const result = await findProviderRoutines(context, input);
          return jsonResponse(providerRoutineFindOutputSchema.parse(result));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
