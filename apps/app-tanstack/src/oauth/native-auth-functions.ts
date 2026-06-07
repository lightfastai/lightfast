import {
  type NativeOrganization,
  nativeClientSchema,
} from "@repo/native-auth-contract";
import { createServerFn } from "@tanstack/react-start";
import { nativeAuthStartSearchSchema } from "./native-auth-validators";

const nativeAuthStartInputSchema = nativeAuthStartSearchSchema.extend({
  client: nativeClientSchema,
});

export const loadNativeAuthOrganizations = createServerFn({ method: "GET" })
  .inputValidator(nativeAuthStartInputSchema)
  .handler(async () => {
    const [
      { getRequest, setResponseHeader },
      { auth },
      { appRouter, createTRPCContext },
      { createTRPCOptionsProxy },
      { createQueryClient },
      { redirectToSignInForOAuth },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@vendor/clerk/server"),
      import("@api/app"),
      import("@trpc/tanstack-react-query"),
      import("~/trpc/query-client"),
      import("./oauth-auth-redirect"),
    ]);

    const request = getRequest();
    const authState = await auth({ treatPendingAsSignedOut: false });
    if (!authState.userId) {
      redirectToSignInForOAuth(request.url);
    }

    const headers = new Headers(request.headers);
    headers.set("x-trpc-source", "tanstack-native-auth-start");

    setResponseHeader("cache-control", "private, no-store");

    const queryClient = createQueryClient();
    const trpc = createTRPCOptionsProxy({
      router: appRouter,
      ctx: () => createTRPCContext({ headers }),
      queryClient: () => queryClient,
    });

    return queryClient.fetchQuery(
      trpc.native.auth.listOrganizations.queryOptions()
    ) as Promise<NativeOrganization[]>;
  });
