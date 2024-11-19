import { useRouter } from "next/navigation";

import { signOut as signOutClient } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";
import { useSession } from "./use-session";

export const useSignOut = () => {
  const router = useRouter();
  const session = useSession();
  const utils = api.useUtils();
  // add session to enable
  const { mutateAsync: signOut } = api.auth.signOut.useMutation({
    onSuccess: () => {
      utils.auth.getSession.invalidate();
      signOutClient({ redirect: true, callbackUrl: "/" });
    },
    onError: (error) => {
      if (error.data?.code === "UNAUTHORIZED") {
        toast({
          title: "Error",
          description: "You are not authorized to sign out",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
        });
      }
    },
  });
  return { signOut };
};
