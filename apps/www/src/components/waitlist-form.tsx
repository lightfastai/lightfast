"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

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
import { useClerk } from "@vendor/clerk/client";

// Define the form schema using Zod
const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

export function WaitlistForm() {
  const clerk = useClerk();
  const { toast } = useToast();

  // Initialize the form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await clerk.joinWaitlist({ emailAddress: values.email });
      toast({
        title: "Success!",
        description: "Successfully joined the waitlist!",
      });
      form.reset(); // Reset form on success
    } catch (error) {
      console.error("Waitlist error:", error);
      let errorMsg = "Failed to join the waitlist. Please try again.";
      if (error instanceof Error) {
        errorMsg = `Failed to join: ${error.message}`;
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
