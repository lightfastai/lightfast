import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

/**
 * Loading skeleton for profile data
 * Matches the exact layout of ProfileDataDisplay
 */
export function ProfileDataLoading() {
  return (
    <div className="space-y-8">
      {/* Avatar Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Avatar</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            This is your avatar.
          </p>
          <p className="text-muted-foreground text-sm">
            Click on the avatar to upload a custom one from your files.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
        </div>

        <p className="text-muted-foreground text-sm">
          An avatar is optional but strongly recommended.
        </p>
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

        <div className="w-full space-y-4">
          <div>
            <Skeleton className="h-10 w-full" />
          </div>

          <p className="text-muted-foreground text-sm">
            Please use 32 characters at maximum.
          </p>

          <div className="flex justify-end">
            <Button disabled variant="secondary">
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Username Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Username</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            This is your URL namespace within Lightfast.
          </p>
        </div>

        <div className="w-full space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              lightfast.ai/
            </span>
            <Skeleton className="h-10 flex-1" />
          </div>

          <p className="text-muted-foreground text-sm">
            Please use 48 characters at maximum.
          </p>

          <div className="flex justify-end">
            <Button disabled variant="secondary">
              Save
            </Button>
          </div>
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

        <div className="w-full">
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
