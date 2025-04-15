"use client";

import type * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

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
import { useToast } from "@repo/ui/hooks/use-toast";

import { waitlistFormSchema } from "~/components/waitlist-form/waitlist-form.validations";

export function WaitlistForm() {
  const { toast } = useToast();

  // Initialize the form
  const form = useForm<z.infer<typeof waitlistFormSchema>>({
    resolver: zodResolver(waitlistFormSchema),
    defaultValues: {
      email: "",
    },
  });

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof waitlistFormSchema>) => {
    try {
      // Call the new API endpoint
      const response = await fetch("/api/waitlist/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: values.email }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Throw an error with the message from the API response if available
        throw new Error(result.error || `API Error: ${response.statusText}`);
      }

      toast({
        title: "Success!",
        description: result.message || "Successfully joined the waitlist!",
      });
      form.reset(); // Reset form on success
    } catch (error) {
      console.error("Waitlist form error:", error);
      let errorMsg = "Failed to join the waitlist. Please try again.";
      if (error instanceof Error) {
        // Use the error message thrown from the try block or a default
        errorMsg = error.message || errorMsg;
      }
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid w-full grid-cols-12 items-start space-x-2"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="col-span-9">
              <FormLabel className="sr-only text-xs">Email</FormLabel>
              <FormControl>
                <Input
                  className="text-xs focus-visible:border-none focus-visible:ring-[1px] focus-visible:ring-ring/50 md:text-xs"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="col-span-3 overflow-hidden truncate rounded-lg px-3 text-xs"
        >
          <span className="text-xs">
            {form.formState.isSubmitting ? "Joining..." : "Join Waitlist"}
          </span>
        </Button>
      </form>
    </Form>
  );
}
