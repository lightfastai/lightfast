import { router } from "@/renderer/routes/router";
import { useAuth, useClerk, useSession } from "@clerk/clerk-react";
import { RouterProvider } from "@tanstack/react-router";

export const InnerApp = () => {
  const clerk = useClerk();
  const session = useSession();
  const auth = useAuth();
  console.log("SIGNIN");

  console.log("-- isSignedIn --");
  console.log("useAuth().isSignedIn", auth.isSignedIn);
  console.log("useSession().isSignedIn", session.isSignedIn);

  console.log("-- session --");
  console.log("useClerk().session", clerk.session);
  console.log("useSession().session", session.session);

  return <RouterProvider router={router} context={{ session }} />;
};
