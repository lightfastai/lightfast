import { useCallback } from "react";

/**
 * Hook to aggressively release focus and dismiss browser extension UI
 * Handles cases like 1Password unlock dialogs, autofill dropdowns, etc.
 */
export const useExtensionFocusRelease = () => {
  const releaseFocus = useCallback((container: Element) => {
    const focusedElement = document.activeElement as HTMLElement;

    if (!focusedElement || !container.contains(focusedElement)) {
      return;
    }

    // Clear text selection if it exists
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }

    // For input elements, clear selection if supported
    if (
      focusedElement instanceof HTMLInputElement ||
      focusedElement instanceof HTMLTextAreaElement
    ) {
      try {
        // Only set selection for inputs that support it (text, textarea, etc.)
        // Email, password, and other input types don't support selection
        if (
          focusedElement instanceof HTMLTextAreaElement ||
          (focusedElement instanceof HTMLInputElement &&
            ["text", "search", "url", "tel"].includes(focusedElement.type))
        ) {
          focusedElement.selectionStart = null;
          focusedElement.selectionEnd = null;
        }
      } catch (error) {
        // Silently ignore if selection is not supported for this input type
        console.debug(
          "Selection not supported for this input type:",
          focusedElement.type,
        );
      }
    }

    // Remove focus
    focusedElement.blur();

    // Aggressively dismiss extension UI and overlays
    // 1. Click elsewhere to dismiss extension dropdowns/overlays
    const bodyClickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    document.body.dispatchEvent(bodyClickEvent);

    // 2. Trigger Escape key to dismiss extension UI
    const escapeKeyEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escapeKeyEvent);

    // 3. Force document body to receive focus
    document.body.focus();

    // 4. Temporarily hide and show the container to force extension re-evaluation
    const containerElement = container as HTMLElement;
    const originalDisplay = containerElement.style.display;
    containerElement.style.display = "none";
    // Use requestAnimationFrame to ensure the display change is processed
    requestAnimationFrame(() => {
      containerElement.style.display = originalDisplay;
    });
  }, []);

  return { releaseFocus };
};
