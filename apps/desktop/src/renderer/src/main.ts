import "@fontsource-variable/geist";
import "./styles.css";
import {
  ACCELERATORS,
  type AcceleratorName,
  type FormatPlatform,
} from "../../shared/accelerators";
import type { LightfastBridge, WindowKind } from "../../shared/ipc";
import { WINDOW_KIND_GLOBAL } from "../../shared/window-globals";
import { installErrorBoundary } from "./error-boundary";
import { createHotkeyManager } from "./hotkey";
import { createSidebarController } from "./sidebar";

// Property names below are literal because TS global augmentation can't
// reference value-level constants. The values themselves come from
// `../../shared/window-globals` — that file is the single source of truth.
declare global {
  interface Window {
    codexWindowType: WindowKind;
    lightfastBridge: LightfastBridge;
  }
}

// Renderer errors are forwarded over IPC to main, which calls captureException
// via `@vendor/observability/sentry-electron-main`. Renderer-side Sentry is
// intentionally disabled to keep the renderer bundle small and Sentry config
// single-source-of-truth in main.
installErrorBoundary(window.lightfastBridge.reportError);

const { buildInfo, platform } = window.lightfastBridge;
const formatPlatform: FormatPlatform =
  platform === "darwin" || platform === "linux" || platform === "win32"
    ? platform
    : "linux";

document.documentElement.dataset.platform = platform;
document.documentElement.dataset.windowKind = window[WINDOW_KIND_GLOBAL];
document.documentElement.dataset.buildFlavor = buildInfo.buildFlavor;
document.body.className =
  "m-0 h-screen overflow-hidden bg-background font-sans text-[13px] text-foreground";
document.getElementById("app")?.classList.add("relative", "flex", "h-full");

function applyThemeVariant(variant: "light" | "dark"): void {
  const classes = document.documentElement.classList;
  classes.toggle("dark", variant === "dark");
}

void window.lightfastBridge.getSystemThemeVariant().then(applyThemeVariant);
window.lightfastBridge.onSystemThemeVariantUpdated(applyThemeVariant);

const sidebar = createSidebarController();

function dispatchAction(name: AcceleratorName): void {
  switch (name) {
    case "toggleSidebar":
      sidebar.toggle();
      break;
    case "settings":
      void window.lightfastBridge.openWindow("settings");
      break;
    case "newWindow":
      void window.lightfastBridge.openWindow("primary");
      break;
    default:
      break;
  }
}

const hotkeys = createHotkeyManager({ platform: formatPlatform });
for (const name of Object.keys(ACCELERATORS) as AcceleratorName[]) {
  hotkeys.on(name, () => dispatchAction(name));
}

window.lightfastBridge.onMenuAction((name) => dispatchAction(name));

void import("./react/entry");
