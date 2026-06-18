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
import { SidebarMenuButton } from "@repo/ui-v2/components/ui/sidebar";
import { useAuthSnapshot } from "../use-auth-snapshot";

export function UserMenu() {
  const auth = useAuthSnapshot();
  const primaryIdentity = auth.userUsername ?? "User";
  const initials = auth.userInitials ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            aria-label="Open user menu"
            className="cursor-default rounded-md [-webkit-app-region:no-drag]"
            size="lg"
            type="button"
          />
        }
      >
        <Avatar>
          <AvatarImage alt="" src={auth.userImageUrl ?? undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="z-100 w-56"
        side="top"
        sideOffset={6}
      >
        {auth.isSignedIn && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{primaryIdentity}</DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => void window.lightfastBridge.openWindow("settings")}
          >
            <HugeiconsIcon icon={SettingsIcon} />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HugeiconsIcon aria-hidden="true" icon={HelpCircleIcon} />
              Help
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
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
                <HugeiconsIcon aria-hidden="true" icon={BookOpen01Icon} />
                Help Docs
              </DropdownMenuItem>
              <DropdownMenuItem
                render={(props) => (
                  <a {...props} href="mailto:support@lightfast.ai">
                    {props.children}
                  </a>
                )}
              >
                <HugeiconsIcon aria-hidden="true" icon={Mail01Icon} />
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
                <HugeiconsIcon aria-hidden="true" icon={ChatFeedbackIcon} />
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
                <HugeiconsIcon icon={LogoutIcon} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
