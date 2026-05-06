import { useSettingsSnapshot } from "../use-settings-snapshot";

const TOGGLES = [
  { key: "launchAtLogin", label: "Launch at login" },
  { key: "showInMenuBar", label: "Show in menu bar" },
  {
    key: "checkForUpdatesAutomatically",
    label: "Check for updates automatically",
  },
] as const;

export function General() {
  const snapshot = useSettingsSnapshot();
  return (
    <section className="settings-section">
      <div className="settings-card">
        {TOGGLES.map(({ key, label }) => (
          <div className="settings-row" key={key}>
            <div className="settings-row__label">{label}</div>
            <label className="switch">
              <input
                aria-label={label}
                checked={snapshot[key]}
                onChange={(e) =>
                  void window.lightfastBridge.updateSetting(
                    key,
                    e.target.checked
                  )
                }
                type="checkbox"
              />
              <span className="switch__track" />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
