"use client";

import type * as z from "zod";
import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { MessageCircle, Send } from "lucide-react";
import Confetti from "react-confetti";

import { Button } from "@repo/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { useToast } from "@repo/ui/hooks/use-toast";
import { useLogger } from "@vendor/observability/use-logger";

import { createEarlyAccessEntrySafe } from "~/components/early-access/api/create-early-access-entry";
import { earlyAccessFormSchema } from "~/components/early-access/early-access-form.schema";
import { EarlyAccessFormErrorMap } from "~/components/early-access/errors";
import { env } from "~/env";
import { useErrorReporter } from "~/lib/error-reporting/client-error-reporter";
import { useEarlyAccessAnalytics } from "./hooks/use-early-access-analytics";
import { earlyAccessCountAtom } from "./jotai/early-access-count-atom";

const INTRO_TEXTS = [
  "Simplifying the way you interact with applications like Blender, Unity, Fusion360 and more.",
  "Lightfast gives your ideas room to grow... to branch, remix and become what they're meant to be.",
  "We integrate with your tools to make your workflow more efficient.",
];

interface ChatMessage {
  id: string;
  content: string;
  isComplete: boolean;
}

export function FloatingEarlyAccessChat() {
  const { toast } = useToast();
  const { reportError } = useErrorReporter();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [_, setWaitlistCount] = useAtom(earlyAccessCountAtom);
  const logger = useLogger();
  const { trackSignup } = useEarlyAccessAnalytics();

  // Text loading states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);

  const form = useForm({
    schema: earlyAccessFormSchema,
    defaultValues: {
      email: "",
    },
  });

  // Sequential text loading effect
  useEffect(() => {
    if (currentMessageIndex >= INTRO_TEXTS.length) {
      setIsLoadingComplete(true);
      return;
    }

    const currentText = INTRO_TEXTS[currentMessageIndex];
    if (!currentText) return;

    // Load full sentences instead of word by word
    const timer = setTimeout(() => {
      const messageId = `message-${currentMessageIndex}`;

      setMessages((prev) => {
        const existingMessageIndex = prev.findIndex(
          (msg) => msg.id === messageId,
        );
        if (existingMessageIndex >= 0) {
          // Update existing message to complete
          const updated = [...prev];
          updated[existingMessageIndex] = {
            id: messageId,
            content: currentText,
            isComplete: true,
          };
          return updated;
        } else {
          // Add new message
          return [
            ...prev,
            { id: messageId, content: currentText, isComplete: false },
          ];
        }
      });

      // Mark as complete after a brief moment to show the animation
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, isComplete: true } : msg,
          ),
        );
      }, 100);

      // Move to next message
      setTimeout(() => {
        setCurrentMessageIndex(currentMessageIndex + 1);
      }, 1200); // Delay before next message
    }, 800); // Initial delay before showing message

    return () => clearTimeout(timer);
  }, [currentMessageIndex]);

  const onSubmit = async (values: z.infer<typeof earlyAccessFormSchema>) => {
    const result = await createEarlyAccessEntrySafe({
      email: values.email,
      logger,
    });

    result.match(
      (data) => {
        // Log success in development
        if (env.NODE_ENV === "development") {
          logger.info("Early access form success:", {
            requestId: data.requestId,
            success: data.success,
          });
        }

        // Track signup with analytics
        trackSignup({
          email: values.email,
          requestId: data.requestId,
        });

        toast({
          title: "Welcome aboard! 🎉",
          description:
            "You've successfully joined the waitlist. We'll notify you when we launch.",
        });

        // Update the waitlist count
        setWaitlistCount((count) => count + 1);

        setIsSubmitted(true);
      },
      (error) => {
        // Report error with context
        reportError(error, {
          component: "FloatingEarlyAccessChat",
          errorType: error.type,
          requestId: error.requestId ?? "unknown",
          error: error.error,
          message: error.message,
          metadata: {
            email: values.email,
          },
        });

        // Log error for debugging in development
        if (env.NODE_ENV === "development") {
          logger.error("Early access form error:", {
            type: error.type,
            error: error.error,
            message: error.message,
            requestId: error.requestId,
          });
        }

        // Get user-friendly message based on error type
        const errorMessage =
          EarlyAccessFormErrorMap[error.type] ||
          "Failed to join the waitlist. Please try again.";

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      },
    );
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
      {/* Always visible chat interface */}
      <div className="bg-background w-80 max-w-[calc(100vw-3rem)] rounded-2xl border shadow-lg">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium">Lightfast</span>
          </div>
          <MessageCircle className="text-muted-foreground h-4 w-4" />
        </div>

        {/* Chat content */}
        <div className="max-h-96 overflow-y-auto p-4">
          {isSubmitted ? (
            <div className="flex flex-col items-center justify-center text-center">
              <Confetti recycle={false} numberOfPieces={200} />
              <p className="mb-2 text-sm font-semibold">
                {form.getValues("email")} is now on the list! 🎉
              </p>
              <p className="text-muted-foreground text-xs">
                We'll notify you when we launch.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sequential bot messages */}
              {messages.map((message) => (
                <div key={message.id} className="flex items-start">
                  <div
                    className={`text-sm transition-all duration-700 ease-out ${
                      message.isComplete
                        ? "opacity-100 blur-none"
                        : "opacity-70 blur-sm"
                    }`}
                  >
                    {message.content}
                    {!message.isComplete && (
                      <span className="ml-1 animate-pulse">|</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Show final message after text loading is complete */}
              {isLoadingComplete && (
                <div className="flex items-start">
                  <div className="text-sm">
                    Ready to get started? Join our waitlist for early access!
                  </div>
                </div>
              )}

              {/* Form - always visible */}
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-3"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              className="pr-12 text-sm"
                              placeholder="Curious? Enter your email for early access"
                              autoComplete="email"
                              {...field}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              disabled={
                                form.formState.isSubmitting ||
                                !field.value?.trim() ||
                                !form.formState.isValid
                              }
                              className="hover:bg-muted absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 p-0"
                            >
                              {form.formState.isSubmitting ? (
                                <div className="border-muted-foreground h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
