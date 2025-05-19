import { createTRPCOptionsProxyWrapper } from "@repo/trpc-client/trpc-react-proxy-provider";
import { $TRPCSource } from "@vendor/trpc";

export const trpc = createTRPCOptionsProxyWrapper({
  url: import.meta.env.VITE_PUBLIC_LIGHTFAST_API_URL,
  source: $TRPCSource.Enum["lightfast-desktop"],
});
