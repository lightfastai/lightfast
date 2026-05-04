import type { ThemeSource } from "../../../../../shared/ipc";
import { useSettingsSnapshot } from "../use-settings-snapshot";

const THEME_OPTIONS: Array<{ value: ThemeSource; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function Appearance() {
  const snapshot = useSettingsSnapshot();
  return (
    <section className="settings-section">
      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row__label">Theme</div>
          <div className="segmented">
            {THEME_OPTIONS.map((option) => (
              <button
                className={
                  snapshot.themeSource === option.value
                    ? "segmented__button active"
                    : "segmented__button"
                }
                key={option.value}
                onClick={() =>
                  void window.lightfastBridge.updateSetting(
                    "themeSource",
                    option.value
                  )
                }
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
