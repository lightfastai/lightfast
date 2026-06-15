import { Button } from "@repo/ui-v2/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui-v2/components/ui/tooltip";
import { cn } from "@repo/ui-v2/lib/utils";
import {
  AddIcon,
  HistoryIcon,
  MessageSquarePlus,
  PanelLeftIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useSyncExternalStore } from "react";
import type { FormatPlatform } from "../../../shared/accelerators";
import type { BuildInfoSnapshot, WindowKind } from "../../../shared/ipc";
import { createSidebarController, SIDEBAR_COLLAPSED_EVENT } from "../sidebar";
import { PrimaryRouter } from "./primary-router";
import { SettingsWindow } from "./settings/settings-window";
import { TeamMenu } from "./team-menu";
import { UserMenu } from "./user-menu";

const appRegionNoDrag = "[-webkit-app-region:no-drag]";
const iconButtonClass =
  "size-6 cursor-default p-0 text-muted-foreground [&_svg]:size-3.5";
const objectiveIndicators = [
  {
    gradientClassName: "from-[#ef4444] via-[#f43f5e] to-[#a855f7]",
    label: "Objective 1",
    selected: true,
  },
  {
    gradientClassName: "from-[#06b6d4] via-[#3b82f6] to-[#4f46e5]",
    label: "Objective 2",
    selected: false,
  },
  {
    gradientClassName: "from-[#f59e0b] via-[#f97316] to-[#e11d48]",
    label: "Objective 3",
    selected: false,
  },
] as const;

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
    <Button
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        "pointer-events-auto absolute top-[7px] left-3 size-[26px] cursor-default text-muted-foreground",
        appRegionNoDrag,
        window.lightfastBridge.platform === "darwin" && "left-24"
      )}
      onClick={() => sidebar.toggle()}
      size="icon-sm"
      title="Toggle sidebar"
      type="button"
      variant="ghost"
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="size-3.5"
        icon={PanelLeftIcon}
        size={14}
      />
    </Button>
  );
}

function ObjectiveIndicator({
  gradientClassName,
}: {
  gradientClassName: string;
}) {
  return (
    <span className="relative flex size-2.5 overflow-hidden rounded-[2px]">
      <span
        className={cn(
          "absolute inset-0 animate-objective-gradient bg-gradient-to-br bg-[length:400%_400%]",
          gradientClassName
        )}
      />
    </span>
  );
}

function IconSidebar() {
  const collapsed = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        "box-border flex h-full w-[52px] flex-col items-center overflow-hidden bg-sidebar pb-11 text-muted-foreground transition-[width] duration-200 ease-in-out",
        collapsed && "w-0"
      )}
      data-kind-primary
    >
      <div className="box-border h-10 flex-shrink-0" />
      <div className="flex w-[52px] flex-shrink-0 flex-col items-center">
        <TeamMenu />
        <div className="flex h-[114px] w-[52px] flex-col items-center justify-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="New chat"
                  className={cn(iconButtonClass, appRegionNoDrag)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon aria-hidden="true" icon={MessageSquarePlus} />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              New Chat
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Recent chats"
                  className={cn(iconButtonClass, appRegionNoDrag)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon aria-hidden="true" icon={HistoryIcon} />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Recent Chats
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="flex w-[52px] flex-1 items-start justify-center pt-8">
        <div className="flex w-[52px] flex-col items-center justify-center gap-1.5">
          {objectiveIndicators.map((objective) => (
            <Button
              aria-label={objective.label}
              className={cn(iconButtonClass, appRegionNoDrag)}
              key={objective.label}
              size="icon-sm"
              type="button"
              variant={objective.selected ? "secondary" : "ghost"}
            >
              <ObjectiveIndicator
                gradientClassName={objective.gradientClassName}
              />
            </Button>
          ))}
          <Button
            aria-label="Add objective"
            className={cn(iconButtonClass, appRegionNoDrag)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon aria-hidden="true" icon={AddIcon} />
          </Button>
        </div>
      </div>
      <div className="mt-8 flex w-[52px] flex-shrink-0 items-center justify-center">
        <UserMenu />
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
      className="box-border flex-1 overflow-auto rounded-tl-xl border-t border-l bg-background p-6 text-muted-foreground"
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
              "absolute top-0 right-0 z-[1] h-10 bg-background",
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
