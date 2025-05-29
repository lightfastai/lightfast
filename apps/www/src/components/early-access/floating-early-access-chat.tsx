"use client";

import type * as z from "zod";
import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { MessageCircle, Send } from "lucide-react";
import Confetti from "react-confetti";

import { Icons } from "@repo/ui/components/icons";
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

  // Scroll-to-minimize states
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

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

  // Scroll detection effect
  useEffect(() => {
    let scrollTimer: NodeJS.Timeout | undefined;

    const handleScroll = () => {
      if (!hasScrolled) {
        setHasScrolled(true);
        setIsMinimized(true);
      }

      // Clear existing timer if it exists
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }

      // Reset minimized state after scrolling stops (optional - keeps it minimized)
      // scrollTimer = setTimeout(() => {
      //   setIsMinimized(false);
      // }, 2000);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
    };
  }, [hasScrolled]);

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
      {/* Morphing container - transitions between chat and button */}
      <div
        onClick={isMinimized ? () => setIsMinimized(false) : undefined}
        className={`bg-background relative overflow-hidden border shadow-lg transition-all duration-800 ease-in-out ${
          isMinimized
            ? "w-auto cursor-pointer rounded-lg px-4 py-3 hover:shadow-xl"
            : "w-96 max-w-[calc(100vw-3rem)] rounded-2xl"
        } `}
      >
        {/* Button content - shows when minimized */}
        <div
          className={`transition-opacity delay-300 duration-500 ease-in-out ${isMinimized ? "opacity-100" : "pointer-events-none opacity-0"} `}
        >
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: "var(--gradient-sky)" }}
            ></div>
            <span className="text-sm font-medium">
              Click here to join our early access
            </span>
          </div>
        </div>

        {/* Chat content - shows when expanded */}
        <div
          className={`transition-opacity delay-300 duration-500 ease-in-out ${isMinimized ? "pointer-events-none absolute inset-0 opacity-0" : "opacity-100"} `}
        >
          {/* Chat header */}
          <div className="flex h-10 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2 leading-none">
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: "var(--gradient-sky)" }}
              ></div>
              <Icons.logoShort className="h-4 w-auto leading-none" />
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
    </div>
  );
}
