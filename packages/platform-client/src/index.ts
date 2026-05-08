// const platform = createPlatformClient({ caller: "app", baseUrl: env.PLATFORM_URL });
// const health = await platform.system.health.query();
import {
  signServiceJWT,
  type PlatformRouter,
  type ServiceCaller,
} from "@api/platform";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

export interface CreatePlatformClientOptions {
  caller: ServiceCaller;
  baseUrl: string;
}

export function createPlatformClient(options: CreatePlatformClientOptions) {
  const { caller, baseUrl } = options;
  return createTRPCClient<PlatformRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl.replace(/\/$/, "")}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await signServiceJWT(caller);
          return {
            authorization: `Bearer ${token}`,
            "x-trpc-source": `service:${caller}`,
          };
        },
      }),
    ],
  });
}

export type { PlatformRouter, ServiceCaller } from "@api/platform";
