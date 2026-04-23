const STORAGE_KEY = "codex-sidebar-demo:sidebar-collapsed";

export interface SidebarController {
  isCollapsed(): boolean;
  setCollapsed(collapsed: boolean): void;
  toggle(): void;
}

function readPersistedState(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writePersistedState(collapsed: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // ignore storage errors (private mode, quota)
  }
}

export function createSidebarController(): SidebarController {
  let collapsed = readPersistedState();
  apply();

  function apply(): void {
    document.documentElement.dataset.sidebarCollapsed = String(collapsed);
    const trigger = document.querySelector<HTMLButtonElement>(
      "[data-sidebar-trigger]"
    );
    if (trigger) {
      trigger.setAttribute("aria-expanded", String(!collapsed));
      trigger.setAttribute(
        "aria-label",
        collapsed ? "Expand sidebar" : "Collapse sidebar"
      );
    }
  }

  return {
    isCollapsed() {
      return collapsed;
    },
    setCollapsed(next) {
      if (next === collapsed) {
        return;
      }
      collapsed = next;
      writePersistedState(collapsed);
      apply();
    },
    toggle() {
      this.setCollapsed(!collapsed);
    },
  };
}
