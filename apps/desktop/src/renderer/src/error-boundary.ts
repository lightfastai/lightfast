import type { RendererErrorPayload } from "../../shared/ipc";

const OVERLAY_ID = "lightfast-desktop-error-overlay";

function ensureOverlay(): HTMLElement {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    return existing;
  }
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className =
    "fixed inset-0 z-[9999] hidden items-center justify-center bg-black/85";
  overlay.innerHTML = `
    <div class="max-w-[520px] rounded-lg border border-white/20 bg-[#282828] px-8 py-6 text-white">
      <h2 class="m-0 mb-3 text-[17px] font-semibold">Something went wrong</h2>
      <pre class="mb-4 max-h-[200px] overflow-auto whitespace-pre-wrap rounded bg-white/3 p-2 font-mono text-[11.4px] text-white/70"></pre>
      <button type="button" class="cursor-default rounded-md border border-white/10 bg-white/3 px-4 py-1.5 text-[12px] text-white">Reload window</button>
    </div>
  `;
  overlay
    .querySelector<HTMLButtonElement>("button")
    ?.addEventListener("click", () => {
      window.location.reload();
    });
  document.body.appendChild(overlay);
  return overlay;
}

function showOverlay(message: string): void {
  const overlay = ensureOverlay();
  const pre = overlay.querySelector<HTMLPreElement>("pre");
  if (pre) {
    pre.textContent = message;
  }
  overlay.dataset.visible = "true";
  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
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
