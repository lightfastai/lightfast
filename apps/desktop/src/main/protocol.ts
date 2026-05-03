import { app, type BrowserWindow } from "electron";

export type ProtocolUrlListener = (url: string) => void;

const listeners = new Set<ProtocolUrlListener>();

export function getProtocolScheme(): "lightfast" | "lightfast-dev" {
  return app.isPackaged ? "lightfast" : "lightfast-dev";
}

export function onProtocolUrl(listener: ProtocolUrlListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerProtocolHandler(
  getWindows: () => BrowserWindow[]
): void {
  const scheme = getProtocolScheme();
  app.setAsDefaultProtocolClient(scheme);

  const dispatch = (rawUrl: string) => {
    if (!rawUrl.startsWith(`${scheme}://`)) {
      return;
    }
    for (const listener of listeners) {
      listener(rawUrl);
    }
    const wins = getWindows();
    const win = wins.find((w) => !w.isDestroyed());
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    }
  };

  // macOS: open-url fires both on first launch (handler delivered before
  // app.whenReady() resolves) and on subsequent dispatches while running.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    dispatch(url);
  });

  // Windows/Linux: a second invocation arrives via single-instance argv.
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((a) => a.startsWith(`${scheme}://`));
    if (url) {
      dispatch(url);
    }
  });

  // First launch on Windows/Linux: URL is in process.argv. Defer one tick so
  // listeners registered after registerProtocolHandler() still observe it.
  if (process.platform !== "darwin") {
    const url = process.argv.find((a) => a.startsWith(`${scheme}://`));
    if (url) {
      void app.whenReady().then(() => dispatch(url));
    }
  }
}
