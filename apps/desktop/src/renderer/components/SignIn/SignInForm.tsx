import { HTMLAttributes, useEffect, useState } from "react";
import { useOAuth } from "@/renderer/hooks/useOAuth";
import { router } from "@/renderer/routes/router";
import { useAuth, useSession, useSignIn } from "@clerk/clerk-react";
import { ClerkAPIError, OAuthStrategy } from "@clerk/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { FieldPath, useForm } from "react-hook-form";
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

  function displayFormErrors(err: SignInError) {
    // This can return an array of errors.
    // See https://clerk.com/docs/custom-flows/error-handling to learn about error handling
    setIsLoading(false);

    const errors = err.errors as ClerkAPIError[];

    const parsedErrors = parseErrors(errors);

    parsedErrors.fieldErrors.forEach((fieldError) => {
      form.setError(
        fieldError.meta?.paramName as FieldPath<authFormValues>,
        fieldError,
      );
    });

    parsedErrors.globalErrors.forEach((globalError) => {
      form.setError("root.globalError", globalError);
    });
  }

  const trySignIn = async (data: z.infer<typeof FormSchema>) => {
    const completeSignIn = await signIn?.create({
      identifier: data.emailAddress,
      password: data.password,
    });

    if (completeSignIn?.status !== "complete") {
      // The status can also be `needs_factor_on', 'needs_factor_two', or 'needs_identifier'
      // Please see https://clerk.com/docs/references/react/use-sign-in#result-status for  more information
      setIsLoading(false);
    }

    if (completeSignIn?.status === "complete") {
      // If complete, user exists and provided password match -- set session active
      if (setActive) {
        await setActive({
          session: completeSignIn.createdSessionId,
          redirectUrl: "/signin",
        });
      }
    }
  };

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    if (!isLoaded) {
      return;
    }

    try {
      await trySignIn(data);
    } catch (err: unknown) {
      const clerkSignInError = err as SignInError;
      if (clerkSignInError.clerkError) {
        for (const error of clerkSignInError.errors) {
          if (error.code === "session_exists") {
            void signOut();
            await trySignIn(data);
          }
        }
      }

      displayFormErrors(clerkSignInError);
    }
  };

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
