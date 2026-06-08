import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useEffect, useSyncExternalStore } from "react";
import type { FormatPlatform } from "../../../shared/accelerators";
import type { BuildInfoSnapshot, WindowKind } from "../../../shared/ipc";
import { createSidebarController, SIDEBAR_COLLAPSED_EVENT } from "../sidebar";
import { PrimaryRouter } from "./primary-router";
import { SettingsWindow } from "./settings/settings-window";

const surfaceClass = "bg-[#f9f9f9] [.electron-dark_&]:bg-[#181818]";
const foregroundClass = "text-[#0d0d0d] [.electron-dark_&]:text-white";
const secondaryTextClass = "text-[#0d0d0d]/70 [.electron-dark_&]:text-white/70";
const borderClass = "border-[#0d0d0d]/10 [.electron-dark_&]:border-white/10";
const lightBorderClass = "border-[#0d0d0d]/5 [.electron-dark_&]:border-white/5";
const iconButtonClass =
  "[-webkit-app-region:no-drag] size-6 cursor-default rounded-md border-0 bg-[#0d0d0d]/3 p-0 text-[#0d0d0d]/50 shadow-none hover:bg-[#0d0d0d]/6 hover:text-[#0d0d0d]/70 [.electron-dark_&]:bg-white/3 [.electron-dark_&]:text-white/50 [.electron-dark_&]:hover:bg-white/7 [.electron-dark_&]:hover:text-white/70 [&_svg]:size-3.5";
const activeIconButtonClass =
  "bg-[#0d0d0d]/10 shadow-[inset_0_0_0_1px_rgb(13_13_13_/_20%)] [.electron-dark_&]:bg-white/10 [.electron-dark_&]:shadow-[inset_0_0_0_1px_rgb(255_255_255_/_16%)]";
const swatchClass =
  "size-2.5 rounded-[2px] shadow-[0_0_0_1px_rgb(255_255_255_/_34%),0_1px_2px_rgb(0_0_0_/_36%)]";

interface DesktopShellProps {
  buildInfo: BuildInfoSnapshot;
  formatPlatform: FormatPlatform;
  windowKind: WindowKind;
}

function useSidebarCollapsed(): boolean {
  const sidebar = createSidebarController();

  return useSyncExternalStore(
    (onStoreChange) => {
      const listener = () => onStoreChange();
      window.addEventListener(SIDEBAR_COLLAPSED_EVENT, listener);
      return () =>
        window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, listener);
    },
    () => sidebar.isCollapsed(),
    () => false
  );
}

function SidebarTrigger() {
  const sidebar = createSidebarController();
  const collapsed = useSidebarCollapsed();

  return (
    <button
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        "pointer-events-auto absolute top-[7px] left-3 inline-flex size-[26px] cursor-default items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-[#0d0d0d]/50 transition-colors [-webkit-app-region:no-drag] hover:bg-[#0d0d0d]/6 hover:text-[#0d0d0d] [.electron-dark_&]:text-white/50 [.electron-dark_&]:hover:bg-white/7 [.electron-dark_&]:hover:text-white",
        window.lightfastBridge.platform === "darwin" && "left-24"
      )}
      onClick={() => sidebar.toggle()}
      title="Toggle sidebar"
      type="button"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 16 16"
        width="14"
      >
        <rect height="10" rx="2" width="12" x="2" y="3" />
        <line x1="6" x2="6" y1="3" y2="13" />
      </svg>
    </button>
  );
}

function LightfastMark() {
  return (
    <svg
      fill="none"
      viewBox="0 0 129.334 129.334"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M124.667 64.66L123.514 72.494 120.1 80.187 114.554 87.62 107.094 94.66 98 101.187 87.627 107.087 76.374 112.26 64.667 116.62 52.96 120.094 41.707 122.614 31.334 124.147 22.24 124.66 14.78 124.147 9.234 122.614 5.82 120.094 4.667 116.62 5.82 112.26 9.234 107.087 14.78 101.187 22.24 94.66 31.334 87.62 41.707 80.187 52.96 72.494 64.667 64.66 76.374 56.827 87.627 49.134 98 41.7 107.094 34.66 114.554 28.134 120.1 22.234 123.514 17.06 124.667 12.7 123.514 9.227 120.1 6.707 114.554 5.174 107.094 4.66 98 5.174 87.627 6.707 76.374 9.227 64.667 12.7 52.96 17.06 41.707 22.234 31.334 28.134 22.24 34.66 14.78 41.7 9.234 49.134 5.82 56.827 4.667 64.66 5.82 72.494 9.234 80.187 14.78 87.62 22.24 94.66 31.334 101.187 41.707 107.087 52.96 112.26 64.667 116.62 76.374 120.094 87.627 122.614 98 124.147 107.094 124.66 114.554 124.147 120.1 122.614 123.514 120.094 124.667 116.62 123.514 112.26 120.1 107.087 114.554 101.187 107.094 94.66 98 87.62 87.627 80.187 76.374 72.494 64.667 64.66 52.96 56.827 41.707 49.134 31.334 41.7 22.24 34.66 14.78 28.134 9.234 22.234 5.82 17.06 4.667 12.7 5.82 9.227 9.234 6.707 14.78 5.174 22.24 4.66 31.334 5.174 41.707 6.707 52.96 9.227 64.667 12.7 76.374 17.06 87.627 22.234 98 28.134 107.094 34.66 114.554 41.7 120.1 49.134 123.514 56.827 124.667 64.66Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="12"
      />
    </svg>
  );
}

function IconSidebar() {
  const collapsed = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        "box-border flex h-full w-[52px] flex-col items-center overflow-hidden pb-11 text-[#0d0d0d]/50 transition-[width] duration-200 ease-in-out [.electron-dark_&]:text-white/50",
        surfaceClass,
        collapsed && "w-0"
      )}
      data-kind-primary
    >
      <div className="box-border h-10 flex-shrink-0" />
      <div className="flex w-[52px] flex-shrink-0 flex-col items-center">
        <div
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-lg text-[#0d0d0d]/50 [&_svg]:size-[18px] [.electron-dark_&]:text-white/50"
        >
          <LightfastMark />
        </div>
        <div className="flex h-[114px] w-[52px] flex-col items-center justify-center gap-2">
          <Button
            aria-label="New chat"
            className={iconButtonClass}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <svg
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path d="M21.5 12a9.5 9.5 0 0 1-14 8.37c-1.87-1.01-3.13-.07-4.24.1a.55.55 0 0 1-.57-.77c.44-1.03.84-2.97.29-4.61A9.5 9.5 0 1 1 21.5 12Z" />
              <path d="M15.5 12h-7M12 8.5v7" />
            </svg>
          </Button>
          <Button
            aria-label="History"
            className={iconButtonClass}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <svg
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path d="M4.43 14.97A9 9 0 1 0 4.62 8.5" />
              <path d="M12.93 7v5l3 2" />
              <path d="M8.43 8.74s-3.68.56-4.24 0 .37-4.24.37-4.24" />
            </svg>
          </Button>
        </div>
      </div>
      <div className="flex w-[52px] flex-1 items-start justify-center pt-8">
        <div className="flex w-[52px] flex-col items-center justify-center gap-1.5">
          <Button
            aria-label="Objective 1"
            className={cn(iconButtonClass, activeIconButtonClass)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <span
              className={cn(
                swatchClass,
                "bg-linear-to-br from-[#5b62d6] via-[#2ea8dc] to-[#f46178]"
              )}
            />
          </Button>
          <Button
            aria-label="Objective 2"
            className={iconButtonClass}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <span
              className={cn(
                swatchClass,
                "bg-linear-to-br from-[#4cc8d6] via-[#2c67d8] to-[#35d783]"
              )}
            />
          </Button>
          <Button
            aria-label="Objective 3"
            className={iconButtonClass}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <span
              className={cn(
                swatchClass,
                "bg-linear-to-br from-[#f0a142] via-[#ef4367] to-[#d8cc4a]"
              )}
            />
          </Button>
          <Button
            aria-label="Add objective"
            className={iconButtonClass}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <svg
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path d="M12 5v14M19 12H5" />
            </svg>
          </Button>
        </div>
      </div>
      <div className="mt-8 flex w-[52px] flex-shrink-0 items-center justify-center">
        <button
          aria-label="Account"
          className="flex size-6 cursor-default items-center justify-center overflow-hidden rounded-md border-0 bg-[#0ea5e9] p-0 shadow-[inset_0_0_0_1px_rgb(0_0_0_/_8%)] [-webkit-app-region:no-drag] hover:opacity-95"
          type="button"
        >
          <span className="h-3 w-6 self-start bg-white/20" />
        </button>
      </div>
    </aside>
  );
}

function PrimaryContent({
  buildInfo,
  formatPlatform,
}: Pick<DesktopShellProps, "buildInfo" | "formatPlatform">) {
  return (
    <section
      className={cn(
        "box-border flex-1 overflow-auto rounded-tl-xl border-t border-l p-6 text-[#0d0d0d]/70 [.electron-dark_&]:text-white/70",
        surfaceClass,
        lightBorderClass
      )}
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
    <section className="h-screen flex-1 bg-transparent p-0" data-kind-settings>
      <div className="box-border h-10 flex-shrink-0" />
      <SettingsWindow platform={formatPlatform} />
    </section>
  );
}

function HudContent() {
  return (
    <section className={cn("p-6", secondaryTextClass)} data-kind-hud>
      <h1 className={cn("m-0 mb-3 font-semibold text-[21px]", foregroundClass)}>
        HUD
      </h1>
      <p className="m-0 mb-3 leading-[1.55]">
        Compact 440&times;320 always-on-top panel. Traffic lights sit tighter at{" "}
        <code
          className={cn(
            "rounded border px-1 py-px font-mono text-[0.92em]",
            borderClass,
            surfaceClass
          )}
        >
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
  const collapsed = useSidebarCollapsed();

  useEffect(() => {
    document.documentElement.dataset.windowKind = windowKind;
  }, [windowKind]);

  return (
    <>
      {windowKind === "primary" && (
        <>
          <div className="pointer-events-none fixed inset-x-0 top-0 z-10 h-10 [-webkit-app-region:drag] data-[platform=win32]:pr-[138px]">
            <SidebarTrigger />
          </div>
          <IconSidebar />
          <div
            className={cn(
              "absolute top-0 right-0 z-[1] h-10",
              surfaceClass,
              collapsed ? "left-0" : "left-[52px]"
            )}
            data-kind-primary
          />
        </>
      )}
      <main
        className={cn(
          "flex flex-1 flex-col bg-transparent",
          windowKind === "primary" ? "mt-10 h-[calc(100%_-_40px)]" : "h-full"
        )}
      >
        {windowKind === "primary" && (
          <PrimaryContent
            buildInfo={buildInfo}
            formatPlatform={formatPlatform}
          />
        )}
        {windowKind === "settings" && (
          <SettingsContent formatPlatform={formatPlatform} />
        )}
        {windowKind === "hud" && <HudContent />}
      </main>
    </>
  );
}
