import { LogoutIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui-v2/components/ui/avatar";
import { Button } from "@repo/ui-v2/components/ui/button";
import { Card } from "@repo/ui-v2/components/ui/card";
import { useAuthSnapshot } from "../../use-auth-snapshot";

const sectionClass = "mb-4 max-w-none";
const cardClass = "mb-4 gap-0 overflow-hidden py-0";
const rowClass = "flex items-center justify-between gap-4 px-4 py-3";
const labelClass = "text-xs text-foreground";

export function Account() {
  const auth = useAuthSnapshot();
  const displayName = auth.userUsername ?? auth.userEmail ?? "Unknown";
  const fallbackInitial =
    (auth.userInitials ?? displayName.trim().charAt(0).toUpperCase()) || "U";

  if (!auth.isSignedIn) {
    return (
      <section className={sectionClass}>
        <Card className={cardClass}>
          <div className={rowClass}>
            <div className={labelClass}>Not signed in</div>
            <Button
              className="cursor-default [-webkit-app-region:no-drag]"
              onClick={() => void window.lightfastBridge.auth.signIn()}
              size="sm"
              type="button"
              variant="outline"
            >
              Sign in
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      <Card className={cardClass}>
        <div className={rowClass}>
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarImage alt="" src={auth.userImageUrl ?? undefined} />
              <AvatarFallback>{fallbackInitial}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-foreground text-xs">
                {displayName}
              </div>
              <div className="text-muted-foreground text-xs">
                {auth.userEmail ?? ""}
              </div>
            </div>
          </div>
        </div>
      </Card>
      <Card className={cardClass}>
        <div className={rowClass}>
          <div className={labelClass}>Sign out of Lightfast</div>
          <Button
            className="cursor-default [-webkit-app-region:no-drag]"
            onClick={() => void window.lightfastBridge.auth.signOut()}
            size="sm"
            type="button"
            variant="destructive"
          >
            <HugeiconsIcon icon={LogoutIcon} size={14} />
            <span>Sign out</span>
          </Button>
        </div>
      </Card>
    </section>
  );
}
