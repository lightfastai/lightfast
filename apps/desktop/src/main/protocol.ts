import { app, type BrowserWindow } from "electron";

export const PROTOCOL_SCHEME = "lightfast";

type DeepLinkHandler = (url: string) => void;

let pendingUrl: string | null = null;
let handler: DeepLinkHandler | null = null;

function deliver(url: string): void {
  if (handler) {
    handler(url);
  } else {
    pendingUrl = url;
  }
}

export function onDeepLink(listener: DeepLinkHandler): void {
  handler = listener;
  if (pendingUrl) {
    listener(pendingUrl);
    pendingUrl = null;
  }
}

export function registerProtocolHandler(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
      process.argv[1] ?? "",
    ]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
  }

  app.on("open-url", (event, url) => {
    event.preventDefault();
    deliver(url);
  });

  app.on("second-instance", (_event, argv) => {
    const urlArg = argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
    if (urlArg) {
      deliver(urlArg);
    }
  });

  const initialUrl = process.argv.find((arg) =>
    arg.startsWith(`${PROTOCOL_SCHEME}://`)
  );
  if (initialUrl) {
    deliver(initialUrl);
  }
}

export function focusForDeepLink(win: BrowserWindow): void {
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
}
