import { SidebarInset } from "@repo/ui-v2/components/ui/sidebar";
import { useEffect } from "react";
import type { FormatPlatform } from "../../../shared/accelerators";
import type { BuildInfoSnapshot, WindowKind } from "../../../shared/ipc";
import { AppSidebar, AppSidebarProvider } from "./components/app-sidebar";
import { PrimaryRouter } from "./primary-router";
import { SettingsWindow } from "./settings/settings-window";

interface DesktopShellProps {
  buildInfo: BuildInfoSnapshot;
  formatPlatform: FormatPlatform;
  windowKind: WindowKind;
}

function PrimaryContent({
  buildInfo,
  formatPlatform,
}: Pick<DesktopShellProps, "buildInfo" | "formatPlatform">) {
  return (
    <section
      className="box-border flex-1 overflow-auto rounded-tl-xl bg-background p-6 text-muted-foreground"
      data-kind-primary
    >
      <PrimaryRouter buildInfo={buildInfo} formatPlatform={formatPlatform} />
    </section>
  );
}

function SettingsContent({
  formatPlatform,
}: Pick<DesktopShellProps, "formatPlatform">) {
  return (
    <section className="h-screen flex-1 bg-background p-0" data-kind-settings>
      <div className="box-border h-10 flex-shrink-0" />
      <SettingsWindow platform={formatPlatform} />
    </section>
  );
}

function HudContent() {
  return (
    <section className="p-6 text-muted-foreground" data-kind-hud>
      <h1 className="m-0 mb-3 font-semibold text-[21px] text-foreground">
        HUD
      </h1>
      <p className="m-0 mb-3 leading-[1.55]">
        Compact 440&times;320 always-on-top panel. Traffic lights sit tighter at{" "}
        <code className="rounded-md border bg-muted px-1 py-px font-mono text-[0.92em] text-foreground">
          {"{ 10, 10}"}
        </code>
        .
      </p>
    </section>
  );
}

export function DesktopShell({
  buildInfo,
  formatPlatform,
  windowKind,
}: DesktopShellProps) {
  useEffect(() => {
    document.documentElement.dataset.windowKind = windowKind;
  }, [windowKind]);

  if (windowKind === "primary") {
    return (
      <PrimaryDesktopShell
        buildInfo={buildInfo}
        formatPlatform={formatPlatform}
      />
    );
  }

  return (
    <main className="flex h-full flex-1 flex-col bg-background text-foreground">
      {windowKind === "settings" && (
        <SettingsContent formatPlatform={formatPlatform} />
      )}
      {windowKind === "hud" && <HudContent />}
    </main>
  );
}

function PrimaryDesktopShell({
  buildInfo,
  formatPlatform,
}: Pick<DesktopShellProps, "buildInfo" | "formatPlatform">) {
  return (
    <AppSidebarProvider>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 h-10 [-webkit-app-region:drag] data-[platform=win32]:pr-[138px]" />
      <AppSidebar />
      <div
        className="absolute top-0 right-0 left-(--sidebar-width-icon) z-[1] h-10 bg-background"
        data-kind-primary
      />
      <SidebarInset className="mt-10 h-[calc(100%_-_40px)]">
        <PrimaryContent buildInfo={buildInfo} formatPlatform={formatPlatform} />
      </SidebarInset>
    </AppSidebarProvider>
  );
}
