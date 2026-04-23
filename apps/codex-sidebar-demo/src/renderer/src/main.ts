import * as Sentry from "@sentry/browser";
import type { LightfastBridge, WindowKind } from "../../shared/ipc";
import { installErrorBoundary } from "./error-boundary";

declare global {
  interface Window {
    codexWindowType: WindowKind;
    lightfastBridge: LightfastBridge;
  }
}

installErrorBoundary(window.lightfastBridge.reportError);

const { buildInfo, platform, sentryInit } = window.lightfastBridge;

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

const buildBadge = document.querySelector<HTMLElement>("[data-build-badge]");
if (buildBadge) {
  buildBadge.textContent = `${buildInfo.buildFlavor} · v${buildInfo.version} (${buildInfo.buildNumber})`;
}

const items = document.querySelectorAll<HTMLButtonElement>(".sidebar .item");

for (const item of items) {
  item.addEventListener("click", () => {
    for (const other of items) {
      other.classList.remove("active");
    }
    item.classList.add("active");
  });
}

const openButtons =
  document.querySelectorAll<HTMLButtonElement>("[data-open-window]");

for (const button of openButtons) {
  button.addEventListener("click", () => {
    const kind = button.dataset.openWindow as WindowKind | undefined;
    if (kind) {
      void window.lightfastBridge.openWindow(kind);
    }
  });
}
