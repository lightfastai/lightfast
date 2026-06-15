import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { SettingRow, SettingsGroup } from "~/components/settings-section";

export function ProfileDataLoading() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-medium font-pp text-foreground text-xl">General</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your personal account settings.
        </p>
      </div>

      <SettingsGroup title="Profile">
        <SettingRow label="Avatar">
          <Skeleton className="size-7 rounded-full" />
        </SettingRow>
        <SettingRow
          description="Please enter your full name, or a display name you are comfortable with."
          label="Display name"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-7 w-16" />
          </div>
        </SettingRow>
        <SettingRow
          description="This is your stable Lightfast handle."
          label="Username"
        >
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-7 w-32" />
            </div>
            <Skeleton className="h-4 w-44" />
          </div>
        </SettingRow>
        <SettingRow description="Your primary email address." label="Email">
          <Skeleton className="h-7 w-64" />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
