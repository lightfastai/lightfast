import { Card } from "@repo/ui-v2/components/ui/card";
import { Separator } from "@repo/ui-v2/components/ui/separator";
import { Switch } from "@repo/ui-v2/components/ui/switch";
import { Fragment } from "react";
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
      <Card className="gap-0 overflow-hidden py-0">
        {TOGGLES.map(({ key, label }, index) => (
          <Fragment key={key}>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="text-foreground text-xs">{label}</div>
              <Switch
                aria-label={label}
                checked={snapshot[key]}
                className="cursor-default [-webkit-app-region:no-drag]"
                onCheckedChange={(checked) =>
                  void window.lightfastBridge.updateSetting(key, checked)
                }
              />
            </div>
            {index < TOGGLES.length - 1 && <Separator />}
          </Fragment>
        ))}
      </Card>
    </section>
  );
}
