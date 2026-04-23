import {
  ACCELERATORS,
  type AcceleratorName,
  type FormatPlatform,
  formatAccelerator,
} from "../../shared/accelerators";
import type { SettingsSnapshot, ThemeSource } from "../../shared/ipc";

export type SettingsSection = "general" | "appearance" | "shortcuts";

const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "shortcuts", label: "Keyboard Shortcuts" },
];

const SHORTCUT_LABELS: Record<AcceleratorName, string> = {
  newThread: "New window",
  newWindow: "New primary window",
  settings: "Open settings",
  toggleSidebar: "Toggle sidebar",
};

const THEME_OPTIONS: Array<{ value: ThemeSource; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const TOGGLE_KEYS = [
  "launchAtLogin",
  "showInMenuBar",
  "checkForUpdatesAutomatically",
] as const;

type ToggleKey = (typeof TOGGLE_KEYS)[number];

const TOGGLE_LABELS: Record<ToggleKey, string> = {
  launchAtLogin: "Launch at login",
  showInMenuBar: "Show in menu bar",
  checkForUpdatesAutomatically: "Check for updates automatically",
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

function renderToggleRow(key: ToggleKey, checked: boolean): string {
  return `
    <div class="settings-row">
      <div class="settings-row__label">${TOGGLE_LABELS[key]}</div>
      <label class="switch">
        <input type="checkbox" data-setting-toggle="${key}"${checked ? " checked" : ""} />
        <span class="switch__track"></span>
      </label>
    </div>
  `;
}

function renderGeneralSection(settings: SettingsSnapshot): string {
  const rows = TOGGLE_KEYS.map((key) =>
    renderToggleRow(key, settings[key])
  ).join("");
  return `
    <section class="settings-section" data-section="general">
      <header class="settings-section__header">
        <div class="settings-section__title">General</div>
      </header>
      <div class="settings-card">${rows}</div>
    </section>
  `;
}

function renderAppearanceSection(settings: SettingsSnapshot): string {
  const buttons = THEME_OPTIONS.map(
    (option) => `
      <button
        type="button"
        data-appearance="${option.value}"
        class="segmented__button${settings.themeSource === option.value ? " active" : ""}"
      >${option.label}</button>
    `
  ).join("");
  return `
    <section class="settings-section" data-section="appearance">
      <header class="settings-section__header">
        <div class="settings-section__title">Appearance</div>
      </header>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row__label">Theme</div>
          <div class="segmented" role="group">${buttons}</div>
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
      </header>
      <div class="settings-card">${rows}</div>
    </section>
  `;
}

export function renderSettings(
  root: HTMLElement,
  platform: FormatPlatform
): void {
  const bridge = window.lightfastBridge;
  let current: SettingsSection = "general";
  let snapshot: SettingsSnapshot = bridge.settings;

  root.innerHTML = `
    <div class="settings-host">
      <aside class="settings-nav">
        ${SECTIONS.map(
          (s) => `
            <button
              type="button"
              class="settings-nav__item${s.id === current ? " active" : ""}"
              data-settings-nav="${s.id}"
            >${s.label}</button>
          `
        ).join("")}
      </aside>
      <div class="settings-content" data-settings-content></div>
    </div>
  `;

  const contentEl = root.querySelector<HTMLElement>("[data-settings-content]");
  const navItems = root.querySelectorAll<HTMLButtonElement>(
    "[data-settings-nav]"
  );

  function wireGeneral(container: HTMLElement): void {
    const toggles = container.querySelectorAll<HTMLInputElement>(
      "[data-setting-toggle]"
    );
    for (const toggle of toggles) {
      toggle.addEventListener("change", () => {
        const key = toggle.dataset.settingToggle as ToggleKey | undefined;
        if (!key) {
          return;
        }
        void bridge.updateSetting(key, toggle.checked);
      });
    }
  }

  function wireAppearance(container: HTMLElement): void {
    const buttons =
      container.querySelectorAll<HTMLButtonElement>("[data-appearance]");
    for (const button of buttons) {
      button.addEventListener("click", () => {
        const value = button.dataset.appearance as ThemeSource | undefined;
        if (!value) {
          return;
        }
        void bridge.updateSetting("themeSource", value);
      });
    }
  }

  function show(section: SettingsSection): void {
    if (!contentEl) {
      return;
    }
    current = section;
    switch (section) {
      case "general":
        contentEl.innerHTML = renderGeneralSection(snapshot);
        wireGeneral(contentEl);
        break;
      case "appearance":
        contentEl.innerHTML = renderAppearanceSection(snapshot);
        wireAppearance(contentEl);
        break;
      case "shortcuts":
        contentEl.innerHTML = renderShortcutsSection(platform);
        break;
      default:
        break;
    }
    for (const item of navItems) {
      item.classList.toggle("active", item.dataset.settingsNav === section);
    }
  }

  for (const item of navItems) {
    item.addEventListener("click", () => {
      const id = item.dataset.settingsNav as SettingsSection | undefined;
      if (id) {
        show(id);
      }
    });
  }

  bridge.onSettingsChanged((next) => {
    snapshot = next;
    show(current);
  });

  show(current);
}
