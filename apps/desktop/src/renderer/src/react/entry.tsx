import { DesktopTRPCProvider } from "@repo/app-trpc/desktop";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./app-shell";
import { UserMenu } from "./user-menu";

const appOrigin = window.lightfastBridge.appOrigin;

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StrictMode>
      <DesktopTRPCProvider baseUrl={appOrigin}>{children}</DesktopTRPCProvider>
    </StrictMode>
  );
}

const container = document.getElementById("react-root");
if (container) {
  createRoot(container).render(
    <Providers>
      <AppShell />
    </Providers>,
  );
}

const userMenuContainer = document.getElementById("user-menu-root");
if (userMenuContainer) {
  createRoot(userMenuContainer).render(
    <Providers>
      <UserMenu />
    </Providers>,
  );
}
