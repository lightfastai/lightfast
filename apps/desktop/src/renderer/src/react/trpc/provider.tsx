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
          const headers = (await bridge?.auth?.getRequestHeaders?.()) ?? {};
          return Object.fromEntries(
            Object.entries(headers).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string"
            )
          );
        },
      }}
    >
      {children}
    </DesktopTRPCReactProvider>
  );
}
