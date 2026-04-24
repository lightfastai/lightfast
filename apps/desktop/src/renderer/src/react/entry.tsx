import { DesktopTRPCProvider } from "@repo/app-trpc/desktop";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./app-shell";

const baseUrl =
  import.meta.env.VITE_LIGHTFAST_API_URL ?? "https://lightfast.ai";

function Root() {
  return (
    <StrictMode>
      <DesktopTRPCProvider baseUrl={baseUrl}>
        <AppShell />
      </DesktopTRPCProvider>
    </StrictMode>
  );
}

const container = document.getElementById("react-root");
if (container) {
  createRoot(container).render(<Root />);
}
