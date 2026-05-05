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
    <div className="settings-window__inner">
      <div className="settings-toolbar" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button
            aria-selected={pane === id}
            className={
              pane === id
                ? "settings-toolbar__tab active"
                : "settings-toolbar__tab"
            }
            key={id}
            onClick={() => setPane(id)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden className="settings-toolbar__icon" size={20} />
            <span className="settings-toolbar__label">{label}</span>
          </button>
        ))}
      </div>
      <div className="settings-pane" role="tabpanel">
        {pane === "account" && <Account />}
        {pane === "general" && <General />}
        {pane === "appearance" && <Appearance />}
        {pane === "shortcuts" && <Shortcuts platform={platform} />}
      </div>
    </div>
  );
}
