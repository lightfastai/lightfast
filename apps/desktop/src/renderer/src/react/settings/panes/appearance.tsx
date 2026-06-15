import { Card } from "@repo/ui-v2/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
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
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="text-foreground text-xs">Theme</div>
          <ToggleGroup
            className="[-webkit-app-region:no-drag]"
            onValueChange={(value) => {
              if (value) {
                void window.lightfastBridge.updateSetting(
                  "themeSource",
                  value as ThemeSource
                );
              }
            }}
            size="sm"
            type="single"
            value={snapshot.themeSource}
            variant="outline"
          >
            {THEME_OPTIONS.map((option) => (
              <ToggleGroupItem
                aria-label={option.label}
                className="cursor-default px-3"
                key={option.value}
                value={option.value}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </Card>
    </section>
  );
}
