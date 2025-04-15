"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { useClerk } from "@vendor/clerk/client";
import { useToast } from "@repo/ui/hooks/use-toast";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Github, Twitter, MessageSquare, Dot } from "lucide-react";
import Link from "next/link";

// Define the form schema using Zod
const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

export default function Home() {
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
    <div className="flex min-h-screen flex-col items-center pt-32">
      <div className="w-full flex flex-col items-center justify-center py-4 gap-4">
        <h1 className="text-center text-5xl font-semibold">
          The future of Design is here
        </h1>
        <p className="text-center text-xl max-w-2xl text-balance text-muted-foreground">
          Simplifying the way you integrate AI workflows into your day to day &#x2014; from design to development
        </p>
      </div>

      <div className="border-t border-b w-full flex flex-col items-center justify-center py-4">
        <div className="w-full max-w-lg space-y-4">
          {/* <h2 className="text-center text-2xl font-semibold">
            Join the Waitlist
          </h2> */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-12 w-full items-start space-x-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="col-span-9">
                    <FormLabel className="sr-only text-xs">Email</FormLabel>
                    <FormControl>
                      <Input
                        className="text-xs md:text-xs focus-visible:border-none focus-visible:ring-[1px] focus-visible:ring-ring/50"
                        placeholder="you@example.com"
                        // type="email"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting} className="text-xs rounded-lg col-span-3 px-3 truncate overflow-hidden">
                <span className="text-xs">
                  {form.formState.isSubmitting ? "Joining..." : "Join Waitlist"}
                </span>
              </Button>
            </form>
          </Form>
        </div>
      </div>

      <div className="w-full max-w-3xl my-8 border rounded-xl overflow-hidden">
        <div className="flex flex-col gap-4 p-64 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.1)_1px,transparent_0)] bg-[length:1rem_1rem]"> </div>
      </div>

      <footer className="w-full mt-auto py-12 px-4 md:px-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <Link href="#" aria-label="GitHub">
              <Github className="size-4 hover:text-foreground" />
            </Link>
            <Link href="#" aria-label="Discord">
              <MessageSquare className="size-4 hover:text-foreground" />
            </Link>
            <Link href="#" aria-label="Twitter">
              <Twitter className="size-4 hover:text-foreground" />
            </Link>
          </div>

          <div className="flex flex-col items-center gap-2">
            <nav className="flex items-center gap-2 md:gap-4">
              <Link href="#" className="text-xs hover:text-foreground">Privacy</Link>
              <Dot className="size-2" />
              <Link href="#" className="text-xs hover:text-foreground">Terms</Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs"> Polychromos Inc. © {new Date().getFullYear()} </span>
          </div>
        </div>
      </footer>
    </div>
  );
}