import type { ReactNode } from "react";

import { DesktopTRPCReactProvider } from "./react";

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
    <DesktopTRPCReactProvider
      options={{
        baseUrl,
        getAuthHeaders: async () => {
          const bridge = (
            window as unknown as {
              lightfastBridge?: { auth?: DesktopBridgeAuth };
            }
          ).lightfastBridge;
          return (await bridge?.auth?.getRequestHeaders?.()) ?? {};
        },
      }}
    >
      {children}
    </DesktopTRPCReactProvider>
  );
}
