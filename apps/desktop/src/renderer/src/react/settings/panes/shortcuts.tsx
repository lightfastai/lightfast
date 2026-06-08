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
    <section className="mb-4 max-w-none">
      <div className="flex flex-col overflow-hidden rounded-lg border border-[#0d0d0d]/10 bg-[#0d0d0d]/4 [.electron-dark_&]:border-white/10 [.electron-dark_&]:bg-white/3">
        {names.map((name) => (
          <div
            className="flex items-center justify-between gap-4 border-[#0d0d0d]/5 border-b px-4 py-3 last:border-b-0 [.electron-dark_&]:border-white/5"
            key={name}
          >
            <div className="text-[#0d0d0d] text-[12px] [.electron-dark_&]:text-white">
              {SHORTCUT_LABELS[name]}
            </div>
            <kbd className="rounded border border-[#0d0d0d]/10 bg-white px-1.5 py-0.5 font-mono text-[#0d0d0d]/70 text-[0.82rem] [.electron-dark_&]:border-white/10 [.electron-dark_&]:bg-[#282828] [.electron-dark_&]:text-white/70">
              {formatAccelerator(ACCELERATORS[name], platform)}
            </kbd>
          </div>
        ))}
      </div>
    </section>
  );
}
