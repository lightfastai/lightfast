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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { Separator } from "@repo/ui/components/ui/separator";
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

    // const parsedErrors = parseErrors(errors);

    // parsedErrors.fieldErrors.forEach((fieldError) => {
    //   form.setError(
    //     fieldError.meta?.paramName as FieldPath<authFormValues>,
    //     fieldError,
    //   );
    // });

    // parsedErrors.globalErrors.forEach((globalError) => {
    //   form.setError("root.globalError", globalError);
    // });
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
    if (signIn) {
      if (strategy === "oauth_github") {
        try {
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
        <h1 className="text-center text-2xl font-medium">Sign In</h1>
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
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 text-left"
          >
            {form.formState.errors.root?.globalError && (
              <p
                className={
                  "text-destructive-foreground mt-1 text-sm font-normal"
                }
              >
                {form.formState.errors.root?.globalError.message}
              </p>
            )}
            <FormField
              control={form.control}
              name="emailAddress"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-md font-normal">
                    Email Address
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect="off"
                      autoFocus
                      placeholder="your@email.com"
                      className="border-muted placeholder:text-muted-foreground/60 h-11 border bg-black/30 font-mono text-sm shadow-inner shadow-black/30 backdrop-blur"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-md font-normal">
                    Password
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      placeholder="Password"
                      className="border-muted placeholder:text-muted-foreground/60 h-11 border bg-black/30 font-mono text-sm shadow-inner shadow-black/30 backdrop-blur"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid">
              <Button
                className="contain ggSmallCaps mt-2 mb-4 w-full gap-2"
                type="submit"
                disabled={isLoading}
              >
                {isLoading && <span>Loading...</span>}
                Sign In
              </Button>
            </div>
            <div className="ggSmallCaps relative grid grid-cols-4 items-center text-xs">
              <Separator className="col-span-1" />
              <div className="align-center text-muted-foreground col-span-2 text-center">
                Or continue with
              </div>
              <Separator className="col-span-1 grid" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="secondary"
                type="button"
                disabled={isLoading}
                onClick={() => signInWith("oauth_github")}
              >
                {isLoading ? (
                  <span>Loading...</span>
                ) : (
                  <Icons.gitHub className="mr-2 h-4 w-4" />
                )}{" "}
                Github
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </>
  );
};
