import { useEffect } from "react";
import { signinRoute } from "@/renderer/routes/route-tree";
import { router } from "@/renderer/routes/router";
import { useAuth, useClerk, useSession } from "@clerk/clerk-react";
import { Navigate } from "@tanstack/react-router";

export const Signout = () => {
  const clerk = useClerk();
  const session = useSession();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    void router.invalidate();
  }, []);
  console.log("SIGNOUT");

  console.log("-- isSignedIn --");
  console.log("useAuth().isSignedIn", isSignedIn);
  console.log("useSession().isSignedIn", session.isSignedIn);

  console.log("-- session --");
  console.log("useClerk().session", clerk.session);
  console.log("useSession().session", session.session);

  return (
    <>
      {session.isSignedIn ? (
        <span>Loading....</span>
      ) : (
        <Navigate to={signinRoute.fullPath} />
      )}
    </>
  );
};
