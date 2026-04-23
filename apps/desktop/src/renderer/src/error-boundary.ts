import type { RendererErrorPayload } from "../../shared/ipc";

const OVERLAY_ID = "lightfast-desktop-error-overlay";

function ensureOverlay(): HTMLElement {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    return existing;
  }
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="error-overlay__panel">
      <h2>Something went wrong</h2>
      <pre class="error-overlay__message"></pre>
      <button type="button" class="error-overlay__reload">Reload window</button>
    </div>
  `;
  overlay
    .querySelector<HTMLButtonElement>(".error-overlay__reload")
    ?.addEventListener("click", () => {
      window.location.reload();
    });
  document.body.appendChild(overlay);
  return overlay;
}

function showOverlay(message: string): void {
  const overlay = ensureOverlay();
  const pre = overlay.querySelector<HTMLPreElement>(".error-overlay__message");
  if (pre) {
    pre.textContent = message;
  }
  overlay.dataset.visible = "true";
}

export function installErrorBoundary(
  report: (payload: RendererErrorPayload) => void
): void {
  window.addEventListener("error", (event) => {
    const message = event.error?.message ?? event.message ?? "Unknown error";
    const stack = event.error?.stack as string | undefined;
    report({
      kind: "error",
      message,
      stack,
      source: event.filename,
    });
    showOverlay(stack ?? message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled rejection";
    const stack = reason instanceof Error ? reason.stack : undefined;
    report({
      kind: "unhandledrejection",
      message,
      stack,
    });
    showOverlay(stack ?? message);
  });
}
