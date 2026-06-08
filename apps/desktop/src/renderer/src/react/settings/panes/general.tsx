import { cn } from "@repo/ui/lib/utils";
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
    <section className="mb-4 max-w-none">
      <div className="flex flex-col overflow-hidden rounded-lg border border-[#0d0d0d]/10 bg-[#0d0d0d]/4 [.electron-dark_&]:border-white/10 [.electron-dark_&]:bg-white/3">
        {TOGGLES.map(({ key, label }) => (
          <div
            className="flex items-center justify-between gap-4 border-[#0d0d0d]/5 border-b px-4 py-3 last:border-b-0 [.electron-dark_&]:border-white/5"
            key={key}
          >
            <div className="text-[#0d0d0d] text-[12px] [.electron-dark_&]:text-white">
              {label}
            </div>
            <label className="relative inline-flex h-[18px] w-[30px] cursor-default items-center">
              <input
                aria-label={label}
                checked={snapshot[key]}
                className="peer absolute inset-0 m-0 cursor-inherit opacity-0"
                onChange={(e) =>
                  void window.lightfastBridge.updateSetting(
                    key,
                    e.target.checked
                  )
                }
                type="checkbox"
              />
              <span
                className={cn(
                  "relative h-full w-full rounded-full border border-[#0d0d0d]/10 bg-white transition-colors after:absolute after:top-px after:left-px after:size-3.5 after:rounded-full after:bg-[#0d0d0d] after:transition-transform after:content-[''] peer-checked:border-transparent peer-checked:bg-[#0a66d6] peer-checked:after:translate-x-3 peer-disabled:opacity-50",
                  "[.electron-dark_&]:border-white/10 [.electron-dark_&]:bg-[#282828] [.electron-dark_&]:after:bg-white [.electron-dark_&]:peer-checked:bg-[#4f9cff]"
                )}
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
