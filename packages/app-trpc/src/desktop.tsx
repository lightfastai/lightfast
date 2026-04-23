import type { ReactNode } from "react";
import { TRPCReactProvider } from "./react";

declare global {
  interface Window {
    lightfastBridge?: {
      auth?: {
        getToken?: () => Promise<string | null> | string | null;
      };
    };
  }
}

interface DesktopTRPCProviderProps {
  children: ReactNode;
  baseUrl: string;
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
          const token = await window.lightfastBridge?.auth?.getToken?.();
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
