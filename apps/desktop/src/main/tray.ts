import { join } from "node:path";
import { app, Menu, nativeImage, Tray } from "electron";

function resolveTrayIcon(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "assets", "trayTemplate.png");
  }
  return join(app.getAppPath(), "src/main/assets/trayTemplate.png");
}

let trayInstance: Tray | null = null;

export interface TrayActions {
  showPrimary: () => void;
  toggleHud: () => void;
}

export function createTray(actions: TrayActions): Tray {
  if (trayInstance) {
    return trayInstance;
  }

  const icon = nativeImage.createFromPath(resolveTrayIcon());
  icon.setTemplateImage(true);

  const tray = new Tray(icon);
  tray.setToolTip(app.getName());

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Window", click: actions.showPrimary },
    { label: "Toggle HUD", click: actions.toggleHud },
    { type: "separator" },
    { role: "quit" },
  ]);
  tray.setContextMenu(contextMenu);

  trayInstance = tray;
  return tray;
}

export function destroyTray(): void {
  trayInstance?.destroy();
  trayInstance = null;
}
