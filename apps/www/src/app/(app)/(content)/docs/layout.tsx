import "~/styles/docs.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider search={{ enabled: false }} theme={{ forcedTheme: "dark" }}>
      {children}
    </RootProvider>
  );
}
