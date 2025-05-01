import { HTMLAttributes, useEffect, useState } from "react";
import { useOAuth } from "@/renderer/hooks/useOAuth";
import { router } from "@/renderer/routes/router";
import { useAuth, useSession, useSignIn } from "@clerk/clerk-react";
import { ClerkAPIError, OAuthStrategy } from "@clerk/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

interface SignInTypes extends HTMLAttributes<HTMLDivElement> {}

interface SignInError {
  errors: ClerkAPIError[];
  clerkError: boolean;
}

const FormSchema = z.object({
  emailAddress: z.string().email(),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters",
  }),
});

type authFormValues = z.infer<typeof FormSchema>;

const defaultValues: Partial<authFormValues> = {
  emailAddress: "",
  password: "",
};

export const SignInForm = ({ className, ...props }: SignInTypes) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { isLoaded, signIn, setActive } = useSignIn();
  const { signOut } = useAuth();
  const { session, isSignedIn } = useSession();
  const navigate = useNavigate();

  const { startOAuthFlow: githubOauthFlow } = useOAuth({
    strategy: "oauth_github",
  });

  const form = useForm<authFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (session && isSignedIn) {
      void router.invalidate().then(() => {
        return navigate({ to: "/" });
      });
    }
  }, [isLoaded, session]);

  const signInWith = (strategy: OAuthStrategy) => {
    console.log("signInWith", strategy);
    if (signIn) {
      console.log("signIn", signIn);
      if (strategy === "oauth_github") {
        try {
          console.log("signInWith", strategy);
          githubOauthFlow({
            redirectUrl: `${import.meta.env.VITE_HTTPS_DOMAIN}/sso-callback`,
          });
        } catch (err: unknown) {
          displayFormErrors(err as SignInError);
        }
      }
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-col text-center">
        <h1 className="text-2xs text-center font-medium">Sign In</h1>
        <p className={`text-md text-muted-foreground`}>
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="text-accent hover:text-accent-foreground inline-flex items-center font-semibold"
          >
            Sign Up
          </Link>
        </p>
      </div>
      <div className={cn("grid", className)} {...props}>
        <Button
          variant="secondary"
          type="button"
          // disabled={isLoading}
          onClick={() => signInWith("oauth_github")}
        >
          {isLoading ? (
            <span>Loading...</span>
          ) : (
            <Icons.gitHub className="mr-2 h-4 w-4" />
          )}
          Github
        </Button>
      </div>
    </>
  );
};
