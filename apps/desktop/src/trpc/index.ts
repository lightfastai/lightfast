import { createTRPCOptionsProxyWrapper } from "@repo/trpc-client/trpc-react-proxy-provider";

export const trpc = createTRPCOptionsProxyWrapper({
  url: import.meta.env.VITE_PUBLIC_LIGHTFAST_API_URL,
  accessToken: localStorage.getItem("auth_access_token") ?? "",
  refreshToken: localStorage.getItem("auth_refresh_token") ?? "",
});
