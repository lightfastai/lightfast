import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthFocusGate, type FocusableWindow } from "../auth-focus-gate";

type WindowSpy = FocusableWindow & {
  show: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
};

function makeWindowSpy(): WindowSpy {
  return { show: vi.fn(), focus: vi.fn() } as WindowSpy;
}

describe("createAuthFocusGate", () => {
  let win: WindowSpy;
  let windows: FocusableWindow[];

  beforeEach(() => {
    win = makeWindowSpy();
    windows = [win];
  });

  it("focuses on signed-out → signed-in transition", () => {
    const gate = createAuthFocusGate({
      initiallySignedIn: false,
      getWindows: () => windows,
    });
    gate({ isSignedIn: true });
    expect(win.show).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(1);
  });

  it("does not focus on signed-in → signed-in (token refresh)", () => {
    const gate = createAuthFocusGate({
      initiallySignedIn: true,
      getWindows: () => windows,
    });
    gate({ isSignedIn: true });
    expect(win.show).not.toHaveBeenCalled();
    expect(win.focus).not.toHaveBeenCalled();
  });

  it("does not focus on signed-in → signed-out (sign-out)", () => {
    const gate = createAuthFocusGate({
      initiallySignedIn: true,
      getWindows: () => windows,
    });
    gate({ isSignedIn: false });
    expect(win.show).not.toHaveBeenCalled();
    expect(win.focus).not.toHaveBeenCalled();
  });

  it("focuses on re-sign-in after sign-out", () => {
    const gate = createAuthFocusGate({
      initiallySignedIn: false,
      getWindows: () => windows,
    });
    gate({ isSignedIn: true });
    gate({ isSignedIn: false });
    gate({ isSignedIn: true });
    expect(win.show).toHaveBeenCalledTimes(2);
    expect(win.focus).toHaveBeenCalledTimes(2);
  });

  it("focuses every window in the list, not just the first", () => {
    const win2 = makeWindowSpy();
    windows = [win, win2];
    const gate = createAuthFocusGate({
      initiallySignedIn: false,
      getWindows: () => windows,
    });
    gate({ isSignedIn: true });
    expect(win.show).toHaveBeenCalledTimes(1);
    expect(win2.show).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(1);
    expect(win2.focus).toHaveBeenCalledTimes(1);
  });

  it("calls getWindows at fire-time, not at gate-construction time", () => {
    const getWindows = vi.fn(() => windows);
    const gate = createAuthFocusGate({
      initiallySignedIn: false,
      getWindows,
    });
    expect(getWindows).not.toHaveBeenCalled();
    gate({ isSignedIn: true });
    expect(getWindows).toHaveBeenCalledTimes(1);
  });

  it("does not call getWindows for non-focusing transitions", () => {
    const getWindows = vi.fn(() => windows);
    const gate = createAuthFocusGate({
      initiallySignedIn: true,
      getWindows,
    });
    gate({ isSignedIn: false });
    gate({ isSignedIn: false });
    expect(getWindows).not.toHaveBeenCalled();
  });
});
