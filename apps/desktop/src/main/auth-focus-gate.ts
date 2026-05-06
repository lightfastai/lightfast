export interface FocusableWindow {
  focus: () => void;
  show: () => void;
}

export interface AuthFocusGateOptions {
  getWindows: () => FocusableWindow[];
  initiallySignedIn: boolean;
}

/**
 * Tracks the signed-in transition so that only a false → true flip yanks
 * focus. Token refreshes (true → true) and sign-outs (true → false) are
 * ignored. Seeding `initiallySignedIn` from the current auth snapshot
 * prevents a false positive when the boot-time `emit(true)` arrives before
 * the subscriber.
 */
export function createAuthFocusGate(
  options: AuthFocusGateOptions
): (snapshot: { isSignedIn: boolean }) => void {
  let prev = options.initiallySignedIn;
  return (snapshot) => {
    const next = Boolean(snapshot.isSignedIn);
    if (!prev && next) {
      for (const win of options.getWindows()) {
        win.show();
        win.focus();
      }
    }
    prev = next;
  };
}
