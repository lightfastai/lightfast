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
import type { EmailCodeFactor } from "@vendor/clerk/types";
import { useForm } from "@vendor/forms";
import { useLogger } from "@vendor/observability/client-log";
import { z } from "zod";
import { handleClerkError } from "~/app/lib/clerk/error-handler";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface SignInEmailInputProps {
  onError: (error: string, isSignUpRestricted?: boolean) => void;
  onSuccess: (email: string) => void;
}

export function SignInEmailInput({
  onSuccess,
  onError,
}: SignInEmailInputProps) {
  const { signIn, isLoaded } = useSignIn();
  const log = useLogger();

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: EmailFormData) {
    if (!signIn) {
      return;
    }

    try {
      // Create sign-in attempt with email
      await signIn.create({
        identifier: data.email,
      });

      const factors = signIn.supportedFirstFactors;
      let emailAddressId: string | undefined;
      if (factors) {
        const emailFactor = factors.find(
          (factor): factor is EmailCodeFactor =>
            factor.strategy === "email_code"
        );
        if (emailFactor) {
          emailAddressId = emailFactor.emailAddressId;
        }
      }

      if (!emailAddressId) {
        onError("Email verification is not supported");
        return;
      }

      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId,
      });

      log.info("[SignInEmailInput] Authentication success", {
        email: data.email,
        timestamp: new Date().toISOString(),
      });
      onSuccess(data.email);
    } catch (err) {
      log.error("[SignInEmailInput] Authentication failed", {
        email: data.email,
        error: err,
      });

      const errorResult = handleClerkError(err, {
        component: "SignInEmailInput",
        action: "create_sign_in",
        email: data.email,
      });

      onError(errorResult.userMessage, errorResult.isSignUpRestricted);
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

        <Button
          className="w-full"
          disabled={!isLoaded || form.formState.isSubmitting}
          size="lg"
          type="submit"
        >
          {form.formState.isSubmitting ? (
            <>
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Continue with Email"
          )}
        </Button>
      </form>
    </Form>
  );
}
