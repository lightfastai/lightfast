import {
  ACCELERATORS,
  type AcceleratorName,
  type FormatPlatform,
  formatAccelerator,
} from "../../../../../shared/accelerators";

const SHORTCUT_LABELS: Record<AcceleratorName, string> = {
  newWindow: "New primary window",
  settings: "Open settings",
  toggleSidebar: "Toggle sidebar",
};

export function Shortcuts({ platform }: { platform: FormatPlatform }) {
  const names = Object.keys(ACCELERATORS) as AcceleratorName[];
  return (
    <section className="settings-section">
      <div className="settings-card">
        {names.map((name) => (
          <div className="settings-row" key={name}>
            <div className="settings-row__label">{SHORTCUT_LABELS[name]}</div>
            <kbd className="settings-row__value">
              {formatAccelerator(ACCELERATORS[name], platform)}
            </kbd>
          </div>
        ))}
      </div>
    </section>
  );
}
