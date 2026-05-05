import { DesktopTRPCProvider } from "@repo/app-trpc/desktop";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { FormatPlatform } from "../../../shared/accelerators";
import { AppShell } from "./app-shell";
import { SettingsWindow } from "./settings/settings-window";
import { UserMenu } from "./user-menu";

const appOrigin = window.lightfastBridge.appOrigin;
const platform = window.lightfastBridge.platform;
const formatPlatform: FormatPlatform =
  platform === "darwin" || platform === "linux" || platform === "win32"
    ? platform
    : "linux";

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StrictMode>
      <DesktopTRPCProvider baseUrl={appOrigin}>{children}</DesktopTRPCProvider>
    </StrictMode>
  );
}

if (window.codexWindowType === "settings") {
  const settingsContainer = document.getElementById("settings-root");
  if (settingsContainer) {
    createRoot(settingsContainer).render(
      <Providers>
        <SettingsWindow platform={formatPlatform} />
      </Providers>
    );
  }
} else {
  const container = document.getElementById("react-root");
  if (container) {
    createRoot(container).render(
      <Providers>
        <AppShell />
      </Providers>
    );
  }

  const userMenuContainer = document.getElementById("user-menu-root");
  if (userMenuContainer) {
    createRoot(userMenuContainer).render(
      <Providers>
        <UserMenu />
      </Providers>
    );
  }
}
