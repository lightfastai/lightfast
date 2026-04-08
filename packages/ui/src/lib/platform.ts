/**
 * Returns true when running on macOS / iOS (i.e. platforms where
 * the "meta" key is Cmd and Ctrl is a separate modifier).
 *
 * Safe to call during SSR — returns false when navigator is unavailable.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/**
 * Returns true when the platform-appropriate modifier key is held.
 * Mac: metaKey (Cmd). Windows/Linux: ctrlKey.
 */
export function isPlatformModifier(
  e: Pick<KeyboardEvent, "metaKey" | "ctrlKey">
): boolean {
  return isMacPlatform() ? e.metaKey : e.ctrlKey;
}

/**
 * Returns the correct modifier key property for synthetic KeyboardEvent dispatch.
 * Mac: { metaKey: true }. Windows/Linux: { ctrlKey: true }.
 */
export function platformModifierKey(): { metaKey: true } | { ctrlKey: true } {
  return isMacPlatform() ? { metaKey: true } : { ctrlKey: true };
}
