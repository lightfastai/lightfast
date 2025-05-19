import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";

export function LogoutButton() {
  const { logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const handleLogout = () => {
    console.log("Logging out...");
    logout();
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleLogout}
          aria-label="Logout"
        >
          <LogOut className="text-muted-foreground size-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Logout</p>
      </TooltipContent>
    </Tooltip>
  );
}
