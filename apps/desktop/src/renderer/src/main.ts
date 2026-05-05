import * as Sentry from "@sentry/browser";
import "./react/entry";
import {
  ACCELERATORS,
  type AcceleratorName,
  type FormatPlatform,
  formatAccelerator,
} from "../../shared/accelerators";
import type { LightfastBridge, WindowKind } from "../../shared/ipc";
import { installErrorBoundary } from "./error-boundary";
import { createHotkeyManager } from "./hotkey";
import { createSidebarController } from "./sidebar";

declare global {
  interface Window {
    codexWindowType: WindowKind;
    lightfastBridge: LightfastBridge;
  }
}

installErrorBoundary(window.lightfastBridge.reportError);

const { buildInfo, platform, sentryInit } = window.lightfastBridge;
const formatPlatform: FormatPlatform =
  platform === "darwin" || platform === "linux" || platform === "win32"
    ? platform
    : "linux";

if (sentryInit.enabled) {
  Sentry.init({
    dsn: sentryInit.dsn,
    release: sentryInit.release,
    environment: sentryInit.environment,
  });
}

document.documentElement.dataset.platform = platform;
document.documentElement.dataset.windowKind = window.codexWindowType;
document.documentElement.dataset.buildFlavor = buildInfo.buildFlavor;

function applyThemeVariant(variant: "light" | "dark"): void {
  const classes = document.documentElement.classList;
  classes.toggle("electron-dark", variant === "dark");
  classes.toggle("electron-light", variant === "light");
}

void window.lightfastBridge.getSystemThemeVariant().then(applyThemeVariant);
window.lightfastBridge.onSystemThemeVariantUpdated(applyThemeVariant);

const buildBadge = document.querySelector<HTMLElement>("[data-build-badge]");
if (buildBadge) {
  buildBadge.textContent = `${buildInfo.buildFlavor} · v${buildInfo.version} (${buildInfo.buildNumber})`;
}

for (const el of document.querySelectorAll<HTMLElement>("[data-kbd-hint]")) {
  const name = el.dataset.kbdHint as AcceleratorName | undefined;
  if (name && name in ACCELERATORS) {
    el.textContent = formatAccelerator(ACCELERATORS[name], formatPlatform);
  }
}

const sidebar = createSidebarController();

for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-open-window]"
)) {
  button.addEventListener("click", () => {
    const kind = button.dataset.openWindow as WindowKind | undefined;
    if (kind) {
      void window.lightfastBridge.openWindow(kind);
    }
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-sidebar-trigger]"
)) {
  button.addEventListener("click", () => sidebar.toggle());
}

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
