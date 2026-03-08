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
import { useSignUp } from "@vendor/clerk/client";
import { useForm } from "@vendor/forms";
import { useLogger } from "@vendor/observability/client-log";
import { z } from "zod";
import { handleClerkError } from "~/app/lib/clerk/error-handler";

const signUpPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignUpPasswordFormData = z.infer<typeof signUpPasswordSchema>;

interface SignUpPasswordProps {
  onError: (error: string) => void;
  onSuccess: (email: string) => void;
}

export function SignUpPassword({ onSuccess, onError }: SignUpPasswordProps) {
  const { signUp, isLoaded } = useSignUp();
  const log = useLogger();

  const form = useForm<SignUpPasswordFormData>({
    resolver: zodResolver(signUpPasswordSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: SignUpPasswordFormData) {
    if (!signUp) {
      return;
    }

    try {
      await signUp.create({
        emailAddress: data.email,
        password: data.password,
      });

      log.info("[SignUpPassword] Sign-up created", {
        email: data.email,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      log.info("[SignUpPassword] Verification code sent", {
        email: data.email,
      });

      onSuccess(data.email);
    } catch (err) {
      log.error("[SignUpPassword] Sign-up failed", {
        email: data.email,
        error: err,
      });

      const errorResult = handleClerkError(err, {
        component: "SignUpPassword",
        action: "create_sign_up",
        email: data.email,
      });

      onError(errorResult.userMessage);
    }
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  className="h-12 bg-background dark:bg-background"
                  placeholder="Email Address"
                  type="email"
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
                  className="h-12 bg-background dark:bg-background"
                  placeholder="Password (8+ characters)"
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
              Creating Account...
            </>
          ) : (
            "Sign up with Password"
          )}
        </Button>
      </form>
    </Form>
  );
}
