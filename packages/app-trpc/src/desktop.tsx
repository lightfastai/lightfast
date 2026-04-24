import type { ReactNode } from "react";
import { TRPCReactProvider } from "./react";

interface DesktopBridgeAuth {
  getToken?: () => Promise<string | null> | string | null;
}

interface DesktopTRPCProviderProps {
  baseUrl: string;
  children: ReactNode;
}

export function DesktopTRPCProvider({
  children,
  baseUrl,
}: DesktopTRPCProviderProps) {
  return (
    <TRPCReactProvider
      options={{
        baseUrl,
        getAuthHeaders: async () => {
          const bridge = (
            window as unknown as {
              lightfastBridge?: { auth?: DesktopBridgeAuth };
            }
          ).lightfastBridge;
          const token = await bridge?.auth?.getToken?.();
          const headers: Record<string, string> = {
            "x-trpc-source": "desktop",
          };
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
          return headers;
        },
      }}
    >
      {children}
    </TRPCReactProvider>
  );
}
