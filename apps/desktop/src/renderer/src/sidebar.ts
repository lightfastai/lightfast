const STORAGE_KEY = "lightfast-desktop:sidebar-collapsed";
export const SIDEBAR_COLLAPSED_EVENT = "lightfast-sidebar-collapsed";

export interface SidebarController {
  isCollapsed(): boolean;
  setCollapsed(collapsed: boolean): void;
  toggle(): void;
}

let controller: SidebarController | null = null;

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
  if (controller) {
    return controller;
  }

  let collapsed = readPersistedState();
  apply();

  function apply(): void {
    document.documentElement.dataset.sidebarCollapsed = String(collapsed);
    window.dispatchEvent(
      new CustomEvent<boolean>(SIDEBAR_COLLAPSED_EVENT, { detail: collapsed })
    );
  }

  controller = {
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

  return controller;
}
