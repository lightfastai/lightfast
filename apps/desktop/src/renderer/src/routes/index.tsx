import { cn } from "@repo/ui/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { ACCELERATORS, formatAccelerator } from "../../../shared/accelerators";
import { AppShell } from "../react/app-shell";

const foregroundClass = "text-[#0d0d0d] [.electron-dark_&]:text-white";
const tertiaryTextClass = "text-[#0d0d0d]/50 [.electron-dark_&]:text-white/50";
const borderClass = "border-[#0d0d0d]/10 [.electron-dark_&]:border-white/10";
const surfaceClass = "bg-[#f9f9f9] [.electron-dark_&]:bg-[#181818]";

export const Route = createFileRoute("/")({
  component: PrimaryIndexRoute,
});

function PrimaryIndexRoute() {
  const { buildInfo, formatPlatform } = Route.useRouteContext();

  return (
    <>
      <AppShell />
      <h1 className={cn("m-0 mb-3 font-semibold text-[21px]", foregroundClass)}>
        Primary window
      </h1>
      <p className="mb-3 leading-[1.55]">
        The left pane is transparent so the <code>NSVisualEffectView</code> (
        <code>vibrancy: &quot;menu&quot;</code>) shows through. Drag the window
        from the top strip; click items to confirm they don&apos;t drag.
      </p>
      <p className={cn("mb-3 leading-[1.55]", tertiaryTextClass)}>
        Press{" "}
        <kbd
          className={cn(
            "rounded border px-1 py-px font-mono text-[0.92em]",
            borderClass,
            surfaceClass
          )}
        >
          {formatAccelerator(ACCELERATORS.toggleSidebar, formatPlatform)}
        </kbd>{" "}
        to toggle the sidebar,{" "}
        <kbd
          className={cn(
            "rounded border px-1 py-px font-mono text-[0.92em]",
            borderClass,
            surfaceClass
          )}
        >
          {formatAccelerator(ACCELERATORS.settings, formatPlatform)}
        </kbd>{" "}
        for settings.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          className={cn(
            "cursor-default rounded-md border px-3 py-1.5 text-[12px]",
            foregroundClass,
            borderClass,
            "bg-[#0d0d0d]/4 hover:bg-white [.electron-dark_&]:bg-white/3 [.electron-dark_&]:hover:bg-white/7"
          )}
          onClick={() => void window.lightfastBridge.openWindow("hud")}
          type="button"
        >
          Open HUD
        </button>
      </div>
      <div className={cn("mt-4 font-mono text-[10.8px]", tertiaryTextClass)}>
        {buildInfo.buildFlavor} · v{buildInfo.version} ({buildInfo.buildNumber})
      </div>
    </>
  );
}
