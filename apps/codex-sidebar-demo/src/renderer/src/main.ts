import type { LightfastBridge, WindowKind } from "../../shared/ipc";

declare global {
  interface Window {
    codexWindowType: WindowKind;
    lightfastBridge: LightfastBridge;
  }
}

document.documentElement.dataset.platform = window.lightfastBridge.platform;
document.documentElement.dataset.windowKind = window.codexWindowType;

const items = document.querySelectorAll<HTMLButtonElement>(".sidebar .item");

for (const item of items) {
  item.addEventListener("click", () => {
    for (const other of items) {
      other.classList.remove("active");
    }
    item.classList.add("active");
  });
}
