import {
  BookOpen01Icon,
  ChatFeedbackIcon,
  HelpCircleIcon,
  LogoutIcon,
  Mail01Icon,
  SettingsIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui-v2/components/ui/avatar";
import { Button } from "@repo/ui-v2/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { useAuthSnapshot } from "./use-auth-snapshot";

export function UserMenu() {
  const auth = useAuthSnapshot();
  const primaryIdentity = auth.userUsername ?? "User";
  const secondaryIdentity = auth.userEmail ?? null;
  const initials = auth.userInitials ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open user menu"
            className="cursor-default overflow-hidden p-0 [-webkit-app-region:no-drag]"
            size="icon"
            type="button"
            variant="square"
          />
        }
      >
        <Avatar className="size-7 rounded-md">
          <AvatarImage alt="" src={auth.userImageUrl ?? undefined} />
          <AvatarFallback className="rounded-md bg-foreground text-[10px] text-background">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="z-[100] w-56"
        side="top"
        sideOffset={6}
      >
        {auth.isSignedIn && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex select-none items-center gap-2">
                <Avatar className="size-6 rounded-md">
                  <AvatarImage alt="" src={auth.userImageUrl ?? undefined} />
                  <AvatarFallback className="rounded-md bg-foreground text-[10px] text-background">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">
                    {primaryIdentity}
                  </p>
                  {secondaryIdentity ? (
                    <p className="truncate text-muted-foreground text-xs">
                      {secondaryIdentity}
                    </p>
                  ) : null}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() =>
              void window.lightfastBridge.openAppPath(
                "/account/settings/general"
              )
            }
          >
            <HugeiconsIcon
              className="flex-shrink-0 text-muted-foreground"
              icon={SettingsIcon}
              size={14}
            />
            Account Settings
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HugeiconsIcon
                aria-hidden="true"
                className="flex-shrink-0 text-muted-foreground"
                icon={HelpCircleIcon}
                size={14}
              />
              Help
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <DropdownMenuItem
                render={(props) => (
                  <a
                    {...props}
                    href="https://lightfast.ai/docs/get-started/overview"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {props.children}
                  </a>
                )}
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="flex-shrink-0 text-muted-foreground"
                  icon={BookOpen01Icon}
                  size={14}
                />
                Help Docs
              </DropdownMenuItem>
              <DropdownMenuItem
                render={(props) => (
                  <a {...props} href="mailto:support@lightfast.ai">
                    {props.children}
                  </a>
                )}
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="flex-shrink-0 text-muted-foreground"
                  icon={Mail01Icon}
                  size={14}
                />
                Contact Support
              </DropdownMenuItem>
              <DropdownMenuItem
                render={(props) => (
                  <a
                    {...props}
                    href="mailto:support@lightfast.ai?subject=Lightfast%20Feedback"
                  >
                    {props.children}
                  </a>
                )}
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="flex-shrink-0 text-muted-foreground"
                  icon={ChatFeedbackIcon}
                  size={14}
                />
                Send Feedback
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        {auth.isSignedIn && (
          <>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => void window.lightfastBridge.auth.signOut()}
              >
                <HugeiconsIcon
                  className="flex-shrink-0 text-muted-foreground"
                  icon={LogoutIcon}
                  size={14}
                />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
