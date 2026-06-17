import { useClerk } from "@clerk/tanstack-react-start";
import {
  BookOpen01Icon,
  HelpCircleIcon,
  LogoutIcon,
  Mail01Icon,
  SettingsIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useMounted } from "@repo/ui/hooks/use-mounted";
import { Avatar, AvatarFallback } from "@repo/ui-v2/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { accountProfileQueryOptions } from "~/account/account-queries";

export function UserMenu() {
  const { signOut } = useClerk();
  const mounted = useMounted();

  const { data: profile, isPending } = useQuery({
    ...accountProfileQueryOptions(),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });

  if (!mounted || isPending || !profile) {
    return <UserMenuSkeleton />;
  }

  const identityLines = [profile.username, profile.primaryEmailAddress].filter(
    (value): value is string => Boolean(value)
  );
  const primaryIdentity = identityLines[0] ?? "User";
  const secondaryIdentity = identityLines[1] ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open user menu"
            className="h-11 w-full justify-start gap-2 rounded-xl px-2 text-left"
            variant="ghost"
          />
        }
      >
        <Avatar className="size-7">
          <AvatarFallback className="bg-foreground text-[10px] text-background">
            {profile.initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-left">
          {primaryIdentity}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" size="sm">
        <DropdownMenuGroup>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar className="size-6">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {profile.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{primaryIdentity}</p>
              {secondaryIdentity ? (
                <p className="truncate text-muted-foreground text-xs">
                  {secondaryIdentity}
                </p>
              ) : null}
            </div>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={<Link preload="intent" to="/account/settings/general" />}
          >
            <HugeiconsIcon aria-hidden="true" icon={SettingsIcon} />
            Your Account
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
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => void signOut({ redirectUrl: "/sign-in" })}
          >
            <HugeiconsIcon aria-hidden="true" icon={LogoutIcon} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenuSkeleton() {
  return (
    <div className="flex h-11 items-center gap-2 rounded-xl px-2">
      <Skeleton className="size-7 rounded-full" />
      <Skeleton className="h-4 min-w-0 flex-1 rounded-xl" />
    </div>
  );
}
