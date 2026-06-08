import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { FormatPlatform } from "../../../shared/accelerators";
import { WINDOW_KIND_GLOBAL } from "../../../shared/window-globals";
import { AuthQueryCacheBoundary } from "./auth-query-cache-boundary";
import { DesktopShell } from "./desktop-shell";
import { DesktopTRPCProvider } from "./trpc/provider";

const appOrigin = window.lightfastBridge.appOrigin;
const platform = window.lightfastBridge.platform;
const buildInfo = window.lightfastBridge.buildInfo;
const windowKind = window[WINDOW_KIND_GLOBAL];
const formatPlatform: FormatPlatform =
  platform === "darwin" || platform === "linux" || platform === "win32"
    ? platform
    : "linux";

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StrictMode>
      <DesktopTRPCProvider baseUrl={appOrigin}>
        <AuthQueryCacheBoundary />
        {children}
      </DesktopTRPCProvider>
    </StrictMode>
  );
}

const container = document.getElementById("app");
if (container) {
  createRoot(container).render(
    <Providers>
      <DesktopShell
        buildInfo={buildInfo}
        formatPlatform={formatPlatform}
        windowKind={windowKind}
      />
    </Providers>
  );
}
