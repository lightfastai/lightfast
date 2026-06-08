import { cn } from "@repo/ui/lib/utils";
import { Settings as Gear, Keyboard, Palette, User } from "lucide-react";
import { useState } from "react";
import type { FormatPlatform } from "../../../../shared/accelerators";
import { Account } from "./panes/account";
import { Appearance } from "./panes/appearance";
import { General } from "./panes/general";
import { Shortcuts } from "./panes/shortcuts";

type PaneId = "account" | "general" | "appearance" | "shortcuts";

const TABS: Array<{ id: PaneId; label: string; Icon: typeof User }> = [
  { id: "account", label: "Account", Icon: User },
  { id: "general", label: "General", Icon: Gear },
  { id: "appearance", label: "Appearance", Icon: Palette },
  { id: "shortcuts", label: "Shortcuts", Icon: Keyboard },
];

export function SettingsWindow({ platform }: { platform: FormatPlatform }) {
  const [pane, setPane] = useState<PaneId>("account");
  return (
    <div className="flex h-screen flex-col bg-transparent">
      <div
        className="flex items-end justify-center gap-1 border-[#0d0d0d]/10 border-b px-4 pt-9 pb-2 [-webkit-app-region:drag] [.electron-dark_&]:border-white/10"
        role="tablist"
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            aria-selected={pane === id}
            className={cn(
              "flex min-w-[72px] cursor-default flex-col items-center gap-1 rounded-md border-0 bg-transparent px-2 py-1.5 text-[#0d0d0d]/50 text-[12px] [-webkit-app-region:no-drag] hover:bg-[#0d0d0d]/6 hover:text-[#0d0d0d]/70 [.electron-dark_&]:text-white/50 [.electron-dark_&]:hover:bg-white/7 [.electron-dark_&]:hover:text-white/70",
              pane === id
                ? "bg-[#0d0d0d]/10 text-[#0d0d0d] [.electron-dark_&]:bg-white/10 [.electron-dark_&]:text-white"
                : undefined
            )}
            key={id}
            onClick={() => setPane(id)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden className="size-5" size={20} />
            <span className="text-[12px]">{label}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5" role="tabpanel">
        {pane === "account" && <Account />}
        {pane === "general" && <General />}
        {pane === "appearance" && <Appearance />}
        {pane === "shortcuts" && <Shortcuts platform={platform} />}
      </div>
    </div>
  );
}
