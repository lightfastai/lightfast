import { createTRPCOptionsProxyWrapper } from "@vendor/trpc/client/react-proxy";

export const trpc = createTRPCOptionsProxyWrapper({
  url: import.meta.env.VITE_PUBLIC_LIGHTFAST_API_URL,
});
