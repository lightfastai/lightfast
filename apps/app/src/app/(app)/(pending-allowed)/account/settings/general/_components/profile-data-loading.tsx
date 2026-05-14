import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function ProfileDataLoading() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          General
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your personal account settings.
        </p>
      </div>

      {/* Avatar Section */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Avatar</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            This is your avatar.
          </p>
        </div>
        <Skeleton className="size-10 rounded-full" />
      </div>

      {/* Display Name Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground text-xl">
            Display Name
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Please enter your full name, or a display name you are comfortable
            with.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 flex-1" />
          <Button disabled variant="secondary">
            Save
          </Button>
        </div>
      </div>

      {/* Email Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Email</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Your primary email address.
          </p>
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
