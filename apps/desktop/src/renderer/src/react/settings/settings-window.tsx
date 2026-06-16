import {
  KeyboardIcon,
  PaintBoardIcon,
  SettingsIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui-v2/components/ui/tabs";
import { useState } from "react";
import type { FormatPlatform } from "../../../../shared/accelerators";
import { Account } from "./panes/account";
import { Appearance } from "./panes/appearance";
import { General } from "./panes/general";
import { Shortcuts } from "./panes/shortcuts";

type PaneId = "account" | "general" | "appearance" | "shortcuts";

const TABS: Array<{ id: PaneId; label: string; icon: IconSvgElement }> = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "appearance", label: "Appearance", icon: PaintBoardIcon },
  { id: "shortcuts", label: "Shortcuts", icon: KeyboardIcon },
];

function isPaneId(value: string): value is PaneId {
  return TABS.some((tab) => tab.id === value);
}

export function SettingsWindow({ platform }: { platform: FormatPlatform }) {
  const [pane, setPane] = useState<PaneId>("account");
  return (
    <Tabs
      className="flex h-screen flex-col bg-transparent"
      onValueChange={(value) => {
        if (isPaneId(value)) {
          setPane(value);
        }
      }}
      value={pane}
    >
      <TabsList className="flex h-auto items-end justify-center gap-1 rounded-none border-x-0 border-t-0 border-b bg-transparent px-4 pt-9 pb-2 [-webkit-app-region:drag]">
        {TABS.map(({ id, label, icon }) => (
          <TabsTrigger
            className="h-auto min-w-[72px] cursor-default flex-col gap-1 px-2 py-1.5 text-xs [-webkit-app-region:no-drag] data-[state=active]:bg-accent data-[state=active]:shadow-none"
            key={id}
            value={id}
          >
            <HugeiconsIcon
              aria-hidden
              className="size-5"
              icon={icon}
              size={20}
            />
            <span>{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent
        className="m-0 min-h-0 flex-1 overflow-y-auto px-6 py-5"
        value="account"
      >
        <Account />
      </TabsContent>
      <TabsContent
        className="m-0 min-h-0 flex-1 overflow-y-auto px-6 py-5"
        value="general"
      >
        <General />
      </TabsContent>
      <TabsContent
        className="m-0 min-h-0 flex-1 overflow-y-auto px-6 py-5"
        value="appearance"
      >
        <Appearance />
      </TabsContent>
      <TabsContent
        className="m-0 min-h-0 flex-1 overflow-y-auto px-6 py-5"
        value="shortcuts"
      >
        <Shortcuts platform={platform} />
      </TabsContent>
    </Tabs>
  );
}
