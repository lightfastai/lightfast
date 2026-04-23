import {
  type AcceleratorName,
  ACCELERATORS,
  formatAccelerator,
  type FormatPlatform,
} from "../../shared/accelerators";

export type SettingsSection =
  | "general"
  | "appearance"
  | "shortcuts";

const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "shortcuts", label: "Keyboard Shortcuts" },
];

const SHORTCUT_LABELS: Record<AcceleratorName, string> = {
  archiveThread: "Archive thread",
  copyConversationPath: "Copy conversation path",
  copyDeeplink: "Copy deep link",
  copySessionId: "Copy session ID",
  copyWorkingDirectory: "Copy working directory",
  dictation: "Dictation",
  findInThread: "Find in thread",
  navigateBack: "Back",
  navigateForward: "Forward",
  newThread: "New thread",
  newThreadAlt: "New thread (alt)",
  newWindow: "New window",
  nextThread: "Next thread",
  openCommandMenu: "Open command menu",
  openCommandMenuAlt: "Open command menu (alt)",
  openFolder: "Open folder…",
  previousThread: "Previous thread",
  quickChat: "Quick chat",
  renameThread: "Rename thread",
  searchChats: "Find in chats",
  searchFiles: "Go to file",
  settings: "Open settings",
  toggleBrowserPanel: "Toggle browser panel",
  toggleDiffPanel: "Toggle diff panel",
  toggleFileTreePanel: "Toggle file tree",
  toggleSidebar: "Toggle sidebar",
  toggleTerminal: "Toggle terminal",
  toggleThreadPin: "Toggle thread pin",
  toggleTraceRecording: "Toggle trace recording",
};

function renderShortcutRow(
  name: AcceleratorName,
  platform: FormatPlatform
): string {
  const combo = formatAccelerator(ACCELERATORS[name], platform);
  return `
    <div class="settings-row">
      <div class="settings-row__label">${SHORTCUT_LABELS[name]}</div>
      <kbd class="settings-row__value">${combo}</kbd>
    </div>
  `;
}

function renderGeneralSection(): string {
  return `
    <section class="settings-section" data-section="general">
      <header class="settings-section__header">
        <div class="settings-section__title">General</div>
      </header>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row__label">Launch at login</div>
          <label class="switch">
            <input type="checkbox" />
            <span class="switch__track"></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">Show in menu bar</div>
          <label class="switch">
            <input type="checkbox" checked />
            <span class="switch__track"></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">Check for updates</div>
          <label class="switch">
            <input type="checkbox" checked />
            <span class="switch__track"></span>
          </label>
        </div>
      </div>
    </section>
  `;
}

function renderAppearanceSection(): string {
  return `
    <section class="settings-section" data-section="appearance">
      <header class="settings-section__header">
        <div class="settings-section__title">Appearance</div>
      </header>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row__label">Theme</div>
          <div class="segmented" role="group">
            <button type="button" data-appearance="system" class="segmented__button active">System</button>
            <button type="button" data-appearance="light" class="segmented__button">Light</button>
            <button type="button" data-appearance="dark" class="segmented__button">Dark</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">Sidebar vibrancy</div>
          <label class="switch">
            <input type="checkbox" checked disabled />
            <span class="switch__track"></span>
          </label>
        </div>
      </div>
    </section>
  `;
}

function renderShortcutsSection(platform: FormatPlatform): string {
  const rows = (Object.keys(ACCELERATORS) as AcceleratorName[])
    .map((name) => renderShortcutRow(name, platform))
    .join("");
  return `
    <section class="settings-section" data-section="shortcuts">
      <header class="settings-section__header">
        <div class="settings-section__title">Keyboard Shortcuts</div>
        <div class="settings-section__subtitle">
          Shortcuts mirror OpenAI Codex's accelerator table. Menu actions send
          through the same IPC channel used by window-local hotkeys.
        </div>
      </header>
      <div class="settings-card">${rows}</div>
    </section>
  `;
}

export function renderSettings(
  root: HTMLElement,
  platform: FormatPlatform
): void {
  const active: SettingsSection = "general";
  root.innerHTML = `
    <div class="settings-host">
      <aside class="settings-nav">
        ${SECTIONS.map(
          (s) => `
            <button
              type="button"
              class="settings-nav__item${s.id === active ? " active" : ""}"
              data-settings-nav="${s.id}"
            >${s.label}</button>
          `
        ).join("")}
      </aside>
      <div class="settings-content" data-settings-content>
        ${renderGeneralSection()}
      </div>
    </div>
  `;

  const contentEl = root.querySelector<HTMLElement>(
    "[data-settings-content]"
  );
  const navItems = root.querySelectorAll<HTMLButtonElement>(
    "[data-settings-nav]"
  );

  function show(section: SettingsSection): void {
    if (!contentEl) return;
    switch (section) {
      case "general":
        contentEl.innerHTML = renderGeneralSection();
        break;
      case "appearance":
        contentEl.innerHTML = renderAppearanceSection();
        wireAppearance(contentEl);
        break;
      case "shortcuts":
        contentEl.innerHTML = renderShortcutsSection(platform);
        break;
    }
    for (const item of navItems) {
      item.classList.toggle(
        "active",
        item.dataset.settingsNav === section
      );
    }
  }

  for (const item of navItems) {
    item.addEventListener("click", () => {
      const id = item.dataset.settingsNav as SettingsSection | undefined;
      if (id) show(id);
    });
  }
}

function wireAppearance(root: HTMLElement): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>(
    "[data-appearance]"
  );
  for (const button of buttons) {
    button.addEventListener("click", () => {
      for (const other of buttons) {
        other.classList.toggle("active", other === button);
      }
    });
  }
}
