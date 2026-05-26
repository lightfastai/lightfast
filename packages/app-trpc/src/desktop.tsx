import type { ReactNode } from "react";
import { TRPCReactProvider } from "./react";

interface DesktopBridgeAuth {
  getRequestHeaders?: () =>
    | Promise<Record<string, string | undefined>>
    | Record<string, string | undefined>;
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
          const nativeHeaders = await bridge?.auth?.getRequestHeaders?.();
          return {
            "x-trpc-source": "desktop",
            "x-lightfast-desktop": "1",
            ...nativeHeaders,
          };
        },
      }}
    >
      {children}
    </TRPCReactProvider>
  );
}
