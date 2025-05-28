import { createTRPCOptionsProxyWrapper } from "@repo/trpc-client/trpc-react-proxy-provider";
import { $TRPCSource } from "@vendor/trpc/headers";

import { getTokenElectronHandler } from "../helpers/auth-helpers";

export const trpc = createTRPCOptionsProxyWrapper({
  url: import.meta.env.VITE_PUBLIC_LIGHTFAST_API_URL,
  source: $TRPCSource.Enum["lightfast-desktop"],
  getTokens: () => getTokenElectronHandler(),
});
