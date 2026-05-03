import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AppEvent = "open-url" | "second-instance" | (string & {});
type AppEventHandler = (...args: unknown[]) => void;

const setAsDefaultProtocolClientMock = vi.fn();
const eventHandlers = new Map<AppEvent, AppEventHandler>();
let isPackagedFlag = false;
let whenReadyResolved = true;

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return isPackagedFlag;
    },
    setAsDefaultProtocolClient: (...args: unknown[]) =>
      setAsDefaultProtocolClientMock(...args),
    on: (event: AppEvent, handler: AppEventHandler) => {
      eventHandlers.set(event, handler);
    },
    whenReady: () =>
      whenReadyResolved
        ? Promise.resolve()
        : new Promise<void>(() => {
            // never resolves
          }),
  },
}));

async function loadProtocol(opts?: {
  isPackaged?: boolean;
  argv?: string[];
  platform?: NodeJS.Platform;
}) {
  vi.resetModules();
  eventHandlers.clear();
  setAsDefaultProtocolClientMock.mockClear();
  isPackagedFlag = opts?.isPackaged ?? false;

  const prevArgv = process.argv;
  const prevPlatform = process.platform;
  if (opts?.argv) {
    process.argv = opts.argv;
  }
  if (opts?.platform) {
    Object.defineProperty(process, "platform", {
      value: opts.platform,
      configurable: true,
    });
  }
  whenReadyResolved = true;

  const mod = await import("../protocol");
  return {
    mod,
    restore: () => {
      process.argv = prevArgv;
      Object.defineProperty(process, "platform", {
        value: prevPlatform,
        configurable: true,
      });
    },
  };
}

function makeWindow(overrides?: {
  destroyed?: boolean;
  minimized?: boolean;
}): {
  win: {
    isDestroyed: () => boolean;
    isMinimized: () => boolean;
    show: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };
} {
  return {
    win: {
      isDestroyed: () => Boolean(overrides?.destroyed),
      isMinimized: () => Boolean(overrides?.minimized),
      show: vi.fn(),
      focus: vi.fn(),
      restore: vi.fn(),
    },
  };
}

describe("protocol", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getProtocolScheme", () => {
    it("returns 'lightfast-dev' when not packaged", async () => {
      const { mod, restore } = await loadProtocol({ isPackaged: false });
      try {
        expect(mod.getProtocolScheme()).toBe("lightfast-dev");
      } finally {
        restore();
      }
    });

    it("returns 'lightfast' when packaged", async () => {
      const { mod, restore } = await loadProtocol({ isPackaged: true });
      try {
        expect(mod.getProtocolScheme()).toBe("lightfast");
      } finally {
        restore();
      }
    });
  });

  describe("registerProtocolHandler", () => {
    beforeEach(() => {
      setAsDefaultProtocolClientMock.mockClear();
    });

    it("registers the dev scheme as the default protocol client when unpackaged", async () => {
      const { mod, restore } = await loadProtocol({ isPackaged: false });
      try {
        mod.registerProtocolHandler(() => []);
        expect(setAsDefaultProtocolClientMock).toHaveBeenCalledWith(
          "lightfast-dev"
        );
      } finally {
        restore();
      }
    });

    it("dispatches matching open-url events to all listeners", async () => {
      const { mod, restore } = await loadProtocol({ isPackaged: false });
      try {
        mod.registerProtocolHandler(() => []);
        const a = vi.fn();
        const b = vi.fn();
        mod.onProtocolUrl(a);
        mod.onProtocolUrl(b);

        const handler = eventHandlers.get("open-url");
        if (!handler) {
          throw new Error("open-url handler not registered");
        }
        const event = { preventDefault: vi.fn() };
        handler(event, "lightfast-dev://auth/callback?code=abc&state=xyz");

        expect(event.preventDefault).toHaveBeenCalled();
        expect(a).toHaveBeenCalledWith(
          "lightfast-dev://auth/callback?code=abc&state=xyz"
        );
        expect(b).toHaveBeenCalledWith(
          "lightfast-dev://auth/callback?code=abc&state=xyz"
        );
      } finally {
        restore();
      }
    });

    it("ignores foreign-scheme URLs", async () => {
      const { mod, restore } = await loadProtocol({ isPackaged: false });
      try {
        mod.registerProtocolHandler(() => []);
        const listener = vi.fn();
        mod.onProtocolUrl(listener);

        const handler = eventHandlers.get("open-url");
        if (!handler) {
          throw new Error("open-url handler not registered");
        }
        handler({ preventDefault: vi.fn() }, "lightfast://auth/callback");

        expect(listener).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });

    it("returning the unsubscribe function detaches the listener", async () => {
      const { mod, restore } = await loadProtocol({ isPackaged: false });
      try {
        mod.registerProtocolHandler(() => []);
        const listener = vi.fn();
        const unsubscribe = mod.onProtocolUrl(listener);
        unsubscribe();

        const handler = eventHandlers.get("open-url");
        handler?.({ preventDefault: vi.fn() }, "lightfast-dev://auth/callback");
        expect(listener).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });

    it("extracts URL from argv on second-instance and dispatches", async () => {
      const { mod, restore } = await loadProtocol({ isPackaged: false });
      try {
        mod.registerProtocolHandler(() => []);
        const listener = vi.fn();
        mod.onProtocolUrl(listener);

        const handler = eventHandlers.get("second-instance");
        if (!handler) {
          throw new Error("second-instance handler not registered");
        }
        handler(
          {},
          [
            "/path/to/electron",
            "--some-flag",
            "lightfast-dev://auth/callback?code=z",
          ]
        );

        expect(listener).toHaveBeenCalledWith(
          "lightfast-dev://auth/callback?code=z"
        );
      } finally {
        restore();
      }
    });

    it("ignores second-instance argv that has no matching scheme", async () => {
      const { mod, restore } = await loadProtocol({ isPackaged: false });
      try {
        mod.registerProtocolHandler(() => []);
        const listener = vi.fn();
        mod.onProtocolUrl(listener);

        const handler = eventHandlers.get("second-instance");
        handler?.({}, ["/path/to/electron", "--some-flag"]);

        expect(listener).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });

    it("surfaces a non-destroyed window on dispatch (show + focus)", async () => {
      const { mod, restore } = await loadProtocol({ isPackaged: false });
      try {
        const { win } = makeWindow({ minimized: false });
        const destroyed = makeWindow({ destroyed: true }).win;
        mod.registerProtocolHandler(() => [destroyed, win] as never);
        mod.onProtocolUrl(vi.fn());

        const handler = eventHandlers.get("open-url");
        handler?.(
          { preventDefault: vi.fn() },
          "lightfast-dev://auth/callback"
        );

        expect(win.show).toHaveBeenCalled();
        expect(win.focus).toHaveBeenCalled();
        expect(win.restore).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });

    it("restores a minimized window on dispatch", async () => {
      const { mod, restore } = await loadProtocol({ isPackaged: false });
      try {
        const { win } = makeWindow({ minimized: true });
        mod.registerProtocolHandler(() => [win] as never);

        const handler = eventHandlers.get("open-url");
        handler?.(
          { preventDefault: vi.fn() },
          "lightfast-dev://auth/callback"
        );

        expect(win.restore).toHaveBeenCalled();
        expect(win.show).toHaveBeenCalled();
        expect(win.focus).toHaveBeenCalled();
      } finally {
        restore();
      }
    });

    it("on Windows/Linux, dispatches a matching URL found in process.argv at first launch", async () => {
      const { mod, restore } = await loadProtocol({
        isPackaged: false,
        platform: "win32",
        argv: [
          "C:/lightfast/electron.exe",
          "lightfast-dev://auth/callback?code=launch",
        ],
      });
      try {
        const listener = vi.fn();
        // Register handler then subscribe — module schedules dispatch via app.whenReady().
        mod.registerProtocolHandler(() => []);
        mod.onProtocolUrl(listener);

        // Flush microtasks (whenReady is resolved).
        await Promise.resolve();
        await Promise.resolve();

        expect(listener).toHaveBeenCalledWith(
          "lightfast-dev://auth/callback?code=launch"
        );
      } finally {
        restore();
      }
    });

    it("on macOS, never reads process.argv for a first-launch URL (relies on open-url)", async () => {
      const { mod, restore } = await loadProtocol({
        isPackaged: false,
        platform: "darwin",
        argv: [
          "/Applications/Lightfast Dev.app",
          "lightfast-dev://auth/callback?code=should-be-ignored",
        ],
      });
      try {
        const listener = vi.fn();
        mod.registerProtocolHandler(() => []);
        mod.onProtocolUrl(listener);

        await Promise.resolve();
        await Promise.resolve();

        expect(listener).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });
  });
});
