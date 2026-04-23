import { promises as fs } from "node:fs";
import { join } from "node:path";
import { app, type BrowserWindow, screen } from "electron";
import type { WindowKind } from "../shared/ipc";

interface WindowBounds {
  height: number;
  isMaximized: boolean;
  width: number;
  x: number;
  y: number;
}

type WindowStateFile = Partial<Record<WindowKind, WindowBounds>>;

const STATE_FILE = join(app.getPath("userData"), "window-state.json");

let cache: WindowStateFile | null = null;
let writeTimer: NodeJS.Timeout | null = null;

async function readStateFile(): Promise<WindowStateFile> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(raw) as WindowStateFile;
  } catch {
    return {};
  }
}

async function ensureCache(): Promise<WindowStateFile> {
  if (!cache) {
    cache = await readStateFile();
  }
  return cache;
}

function scheduleWrite(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
  }
  writeTimer = setTimeout(() => {
    writeTimer = null;
    if (!cache) {
      return;
    }
    void fs.writeFile(STATE_FILE, JSON.stringify(cache, null, 2), "utf8");
  }, 250);
}

function isOnVisibleDisplay(bounds: WindowBounds): boolean {
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const area = display.workArea;
    return (
      bounds.x >= area.x - bounds.width + 80 &&
      bounds.x <= area.x + area.width - 80 &&
      bounds.y >= area.y &&
      bounds.y <= area.y + area.height - 40
    );
  });
}

export async function loadWindowState(
  kind: WindowKind
): Promise<Partial<WindowBounds>> {
  const state = await ensureCache();
  const saved = state[kind];
  if (!saved) {
    return {};
  }
  if (!isOnVisibleDisplay(saved)) {
    return { width: saved.width, height: saved.height };
  }
  return saved;
}

export function trackWindowState(kind: WindowKind, win: BrowserWindow): void {
  const persist = () => {
    if (win.isDestroyed()) {
      return;
    }
    const bounds = win.getNormalBounds();
    cache = {
      ...(cache ?? {}),
      [kind]: {
        ...bounds,
        isMaximized: win.isMaximized(),
      },
    };
    scheduleWrite();
  };

  win.on("resize", persist);
  win.on("move", persist);
  win.on("maximize", persist);
  win.on("unmaximize", persist);
  win.once("close", persist);
}
