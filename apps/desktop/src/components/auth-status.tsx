import { useEffect } from "react";

import { Button } from "@repo/ui/components/ui/button";
import { useUser } from "@vendor/clerk/react";

import { useElectronAuth } from "../hooks/use-electron-auth";

export function AuthStatus() {
  const { user, isLoaded: userLoaded } = useUser();
  const { persistToken, signOut } = useElectronAuth();

  // Persist the token when user logs in
  useEffect(() => {
    if (userLoaded && user) {
      persistToken();
    }
  }, [userLoaded, user, persistToken]);

  if (!userLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-foreground">
        Logged in as:{" "}
        <span className="font-medium">
          {user?.primaryEmailAddress?.emailAddress}
        </span>
      </div>
      <Button variant="outline" onClick={signOut}>
        Sign Out
      </Button>
    </div>
  );
}
