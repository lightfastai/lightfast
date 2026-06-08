import { cn } from "@repo/ui/lib/utils";
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
    <section className="mb-4 max-w-none">
      <div className="flex flex-col overflow-hidden rounded-lg border border-[#0d0d0d]/10 bg-[#0d0d0d]/4 [.electron-dark_&]:border-white/10 [.electron-dark_&]:bg-white/3">
        <div className="flex items-center justify-between gap-4 border-[#0d0d0d]/5 border-b px-4 py-3 last:border-b-0 [.electron-dark_&]:border-white/5">
          <div className="text-[#0d0d0d] text-[12px] [.electron-dark_&]:text-white">
            Theme
          </div>
          <div className="inline-flex rounded-md border border-[#0d0d0d]/10 bg-white p-0.5 [.electron-dark_&]:border-white/10 [.electron-dark_&]:bg-[#282828]">
            {THEME_OPTIONS.map((option) => (
              <button
                aria-pressed={snapshot.themeSource === option.value}
                className={cn(
                  "cursor-default rounded px-2 py-1 text-[#0d0d0d]/50 text-[12px] hover:text-[#0d0d0d]/70 [.electron-dark_&]:text-white/50 [.electron-dark_&]:hover:text-white/70",
                  snapshot.themeSource === option.value
                    ? "bg-[#0d0d0d]/4 text-[#0d0d0d] [.electron-dark_&]:bg-white/7 [.electron-dark_&]:text-white"
                    : undefined
                )}
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
