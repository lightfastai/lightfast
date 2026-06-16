import { Button } from "@repo/ui-v2/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { ACCELERATORS, formatAccelerator } from "../../../shared/accelerators";
import { AppShell } from "../react/app-shell";

export const Route = createFileRoute("/")({
  component: PrimaryIndexRoute,
});

function PrimaryIndexRoute() {
  const { buildInfo, formatPlatform } = Route.useRouteContext();

  return (
    <>
      <AppShell />
      <h1 className="m-0 mb-3 font-semibold text-[21px] text-foreground">
        Primary window
      </h1>
      <p className="mb-3 leading-[1.55]">
        The left pane is transparent so the <code>NSVisualEffectView</code> (
        <code>vibrancy: &quot;menu&quot;</code>) shows through. Drag the window
        from the top strip; click items to confirm they don&apos;t drag.
      </p>
      <p className="mb-3 text-muted-foreground leading-[1.55]">
        Press{" "}
        <kbd className="rounded-md border bg-muted px-1 py-px font-mono text-[0.92em] text-foreground">
          {formatAccelerator(ACCELERATORS.toggleSidebar, formatPlatform)}
        </kbd>{" "}
        to toggle the sidebar,{" "}
        <kbd className="rounded-md border bg-muted px-1 py-px font-mono text-[0.92em] text-foreground">
          {formatAccelerator(ACCELERATORS.settings, formatPlatform)}
        </kbd>{" "}
        for settings.
      </p>
      <div className="mt-4 flex gap-2">
        <Button
          className="cursor-default [-webkit-app-region:no-drag]"
          onClick={() => void window.lightfastBridge.openWindow("hud")}
          size="sm"
          type="button"
          variant="outline"
        >
          Open HUD
        </Button>
      </div>
      <div className="mt-4 font-mono text-[10.8px] text-muted-foreground">
        {buildInfo.buildFlavor} · v{buildInfo.version} ({buildInfo.buildNumber})
      </div>
    </>
  );
}
