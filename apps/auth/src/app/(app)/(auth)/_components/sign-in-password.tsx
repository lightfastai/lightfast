"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { useSignIn } from "@vendor/clerk/client";
import { useForm } from "@vendor/forms";
import { useLogger } from "@vendor/observability/client-log";
import { z } from "zod";
import { handleClerkError } from "~/app/lib/clerk/error-handler";

const passwordSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface SignInPasswordProps {
  onError: (error: string) => void;
  onSuccess: () => void;
}

export function SignInPassword({ onSuccess, onError }: SignInPasswordProps) {
  const { signIn, isLoaded } = useSignIn();
  const log = useLogger();

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  async function onSubmit(data: PasswordFormData) {
    if (!signIn) {
      return;
    }

    try {
      // Attempt to sign in with password
      const result = await signIn.create({
        identifier: data.identifier,
        password: data.password,
      });

      if (result.status === "complete") {
        log.info("[SignInPassword] Authentication success", {
          timestamp: new Date().toISOString(),
        });
        onSuccess();
      } else {
        log.error("[SignInPassword] Authentication failed", {
          error: "Sign-in incomplete",
        });
        onError("Sign-in could not be completed. Please try again.");
      }
    } catch (err) {
      log.error("[SignInPassword] Authentication failed", {
        error: err,
      });

      const errorResult = handleClerkError(err, {
        component: "SignInPassword",
        action: "password_sign_in",
        identifier: data.identifier,
      });

      onError(errorResult.userMessage);
    }
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  className="bg-background dark:bg-background"
                  placeholder="Email or username"
                  size="lg"
                  type="text"
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
            <FormItem>
              <FormControl>
                <Input
                  className="bg-background dark:bg-background"
                  placeholder="Password"
                  size="lg"
                  type="password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          className="w-full"
          disabled={!isLoaded || form.formState.isSubmitting}
          size="lg"
          type="submit"
        >
          {form.formState.isSubmitting ? (
            <>
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in with Password"
          )}
        </Button>
      </form>
    </Form>
  );
}
