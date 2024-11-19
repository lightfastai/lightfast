import { useRouter } from "next/navigation";

import { toast } from "@repo/ui/hooks/use-toast";

import { api } from "~/trpc/react";
import { useSession } from "./use-session";

export const useSignOut = () => {
  const router = useRouter();
  const session = useSession();
  // add session to enable
  const { mutateAsync: signOut } = api.auth.signOut.useMutation({
    onSuccess: () => router.push("/"),
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
