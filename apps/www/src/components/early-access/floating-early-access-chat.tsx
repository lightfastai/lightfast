"use client";

import type * as z from "zod";
import { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { Send, X } from "lucide-react";
import Confetti from "react-confetti";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
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

// Timing constants (in milliseconds)
const AUTO_EXPAND_DELAY = 500; // Delay before auto-expanding
const MESSAGE_DELAY = 800; // Delay before showing each message
const MESSAGE_COMPLETE_DELAY = 100; // Delay before marking message as complete
const NEXT_MESSAGE_DELAY = 400; // Delay before showing next message

// LocalStorage key for tracking onboarding status
const EARLY_ACCESS_ONBOARDED_KEY = "lightfast_early_access_onboarded";
// Feature flag to enable/disable localStorage onboarding tracking
const ENABLE_ONBOARDING_TRACKING = false;

const INTRO_TEXTS = [
  "Simplifying the way you interact with applications like Blender, Unity, Fusion360 and more.",
  "Lightfast gives your ideas room to grow... to branch, remix and become what they're meant to be.",
  "We integrate with your tools to make your workflow more efficient.",
];

// Helper functions for localStorage
const isUserOnboarded = (): boolean => {
  if (!ENABLE_ONBOARDING_TRACKING) return false;
  try {
    return localStorage.getItem(EARLY_ACCESS_ONBOARDED_KEY) === "true";
  } catch {
    return false; // Fallback if localStorage is disabled
  }
};

const markUserAsOnboarded = (): void => {
  if (!ENABLE_ONBOARDING_TRACKING) return;
  try {
    localStorage.setItem(EARLY_ACCESS_ONBOARDED_KEY, "true");
  } catch {
    // Silently fail if localStorage is disabled
  }
};

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
  const hasStreamedOnce = useRef(false);
  const wasAutoExpanded = useRef(false);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Card expand/collapse state
  const [isExpanded, setIsExpanded] = useState(false);

  // Animated intro message states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);
  const chatCardRef = useRef<HTMLDivElement>(null);
  const logoButtonRef = useRef<HTMLButtonElement>(null);

  // Helper to add timeout with cleanup tracking
  const addTimeout = (callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      // Remove from tracking array when executed
      timeoutRefs.current = timeoutRefs.current.filter(
        (id) => id !== timeoutId,
      );
      callback();
    }, delay);
    timeoutRefs.current.push(timeoutId);
    return timeoutId;
  };

  // Helper to clear all tracked timeouts
  const clearAllTimeouts = () => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
  };

  // Reset refs on component mount to ensure clean state
  useEffect(() => {
    // Reset all refs to initial state on mount
    hasStreamedOnce.current = false;
    wasAutoExpanded.current = false;
    timeoutRefs.current = [];

    // Cleanup on unmount
    return () => {
      clearAllTimeouts();
    };
  }, []);

  // Auto-expand effect
  useEffect(() => {
    if (!hasStreamedOnce.current && !isUserOnboarded()) {
      addTimeout(() => {
        setIsExpanded(true);
        wasAutoExpanded.current = true;
        markUserAsOnboarded();
      }, AUTO_EXPAND_DELAY);
    }
    return clearAllTimeouts;
  }, []);

  // Sequential text loading effect
  useEffect(() => {
    if (!isExpanded || hasStreamedOnce.current) {
      return;
    }

    if (currentMessageIndex >= INTRO_TEXTS.length) {
      setIsLoadingComplete(true);
      hasStreamedOnce.current = true;
      return;
    }

    const currentText = INTRO_TEXTS[currentMessageIndex];
    if (!currentText) return;

    addTimeout(() => {
      const messageId = `message-${currentMessageIndex}`;
      setMessages((prev) => {
        const existingMessageIndex = prev.findIndex(
          (msg) => msg.id === messageId,
        );
        if (existingMessageIndex >= 0) {
          const updated = [...prev];
          updated[existingMessageIndex] = {
            id: messageId,
            content: currentText,
            isComplete: true,
          };
          return updated;
        } else {
          return [
            ...prev,
            { id: messageId, content: currentText, isComplete: false },
          ];
        }
      });

      addTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, isComplete: true } : msg,
          ),
        );
      }, MESSAGE_COMPLETE_DELAY);

      addTimeout(() => {
        setCurrentMessageIndex(currentMessageIndex + 1);
      }, NEXT_MESSAGE_DELAY);
    }, MESSAGE_DELAY);
  }, [currentMessageIndex, isExpanded]);

  // Reset messages when card is closed or re-opened
  useEffect(() => {
    if (!isExpanded) {
      setMessages([]);
      setCurrentMessageIndex(0);
      setIsLoadingComplete(false);
    } else if (hasStreamedOnce.current) {
      // If already streamed, show all messages as complete
      setMessages(
        INTRO_TEXTS.map((content, idx) => ({
          id: `message-${idx}`,
          content,
          isComplete: true,
        })),
      );
      setCurrentMessageIndex(INTRO_TEXTS.length);
      setIsLoadingComplete(true);
    }
  }, [isExpanded]);

  // Close chat on scroll (only if auto-expanded)
  useEffect(() => {
    if (!isExpanded || !wasAutoExpanded.current) return;
    const handleScroll = () => {
      setIsExpanded(false);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isExpanded]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC to close
      if (event.key === "Escape" && isExpanded) {
        event.preventDefault();
        setIsExpanded(false);
        // Return focus to logo button when closing with ESC
        logoButtonRef.current?.focus();
        return;
      }

      // "/" to focus input (only when chat is expanded and not submitted)
      if (
        event.key === "/" &&
        isExpanded &&
        !isSubmitted &&
        chatCardRef.current
      ) {
        const emailInput = chatCardRef.current.querySelector(
          'input[type="email"]',
        );
        if (
          emailInput &&
          emailInput instanceof HTMLInputElement &&
          document.activeElement !== emailInput
        ) {
          event.preventDefault();
          emailInput.focus();
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, isSubmitted]);

  // Focus management
  useEffect(() => {
    if (isExpanded && chatCardRef.current) {
      // Focus the first interactive element (close button) when expanding
      const firstButton = chatCardRef.current.querySelector("button");
      firstButton?.focus();
    }
  }, [isExpanded]);

  const form = useForm({
    schema: earlyAccessFormSchema,
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof earlyAccessFormSchema>) => {
    const result = await createEarlyAccessEntrySafe({
      email: values.email,
      logger,
    });
    result.match(
      (data) => {
        if (env.NODE_ENV === "development") {
          logger.info("Early access form success:", {
            requestId: data.requestId,
            success: data.success,
          });
        }
        trackSignup({
          email: values.email,
          requestId: data.requestId,
        });
        toast({
          title: "Welcome aboard! 🎉",
          description:
            "You've successfully joined the waitlist. We'll notify you when we launch.",
        });
        setWaitlistCount((count) => count + 1);
        setIsSubmitted(true);
        markUserAsOnboarded();
      },
      (error) => {
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
        if (env.NODE_ENV === "development") {
          logger.error("Early access form error:", {
            type: error.type,
            error: error.error,
            message: error.message,
            requestId: error.requestId,
          });
        }
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
    <div
      className="fixed bottom-6 left-6 z-50 flex flex-col items-start"
      role="complementary"
      aria-label="Early access signup"
    >
      <div className="relative">
        {/* Expanding Card - always in DOM, class toggles for smooth transition */}
        <div
          className={`expanding-card ${isExpanded ? "expanded" : "collapsed"}`}
          ref={chatCardRef}
          role="dialog"
          aria-modal={isExpanded}
          aria-labelledby="chat-title"
          aria-describedby="chat-description"
        >
          <Card className="bg-background/90 w-108 shadow-xl backdrop-blur-sm">
            <CardContent className="space-y-4">
              {/* Header area with close button */}
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  aria-label="Close early access chat"
                  onClick={() => {
                    // If user manually opens, disable auto-scroll-close
                    if (!isExpanded) {
                      wasAutoExpanded.current = false;
                      markUserAsOnboarded();
                    }
                    setIsExpanded((prev) => !prev);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Hidden title for screen readers */}
              <h2 id="chat-title" className="sr-only">
                Early Access Chat
              </h2>
              <div id="chat-description" className="sr-only">
                Sign up for early access to Lightfast
              </div>
              {/* Animated intro messages */}
              <div className="space-y-4" aria-live="polite" aria-atomic="false">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="text-sm"
                    role="status"
                    aria-live={message.isComplete ? "off" : "polite"}
                  >
                    <span
                      className={`transition-all duration-700 ease-out ${
                        message.isComplete
                          ? "opacity-100 blur-none"
                          : "opacity-70 blur-sm"
                      }`}
                    >
                      {message.content}
                      {!message.isComplete && (
                        <span className="ml-1 animate-pulse" aria-hidden="true">
                          |
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {/* Bottom row - Input area with space for logo */}
              <div className="relative flex items-center gap-3">
                {/* Space for logo - positioned to align with the clickable logo */}
                <div className="h-12 w-8 flex-shrink-0" />
                <div className="relative flex-1">
                  {isSubmitted ? (
                    <div
                      className="flex flex-col items-center justify-center text-center"
                      role="status"
                      aria-live="polite"
                    >
                      <Confetti recycle={false} numberOfPieces={200} />
                      <p className="mb-2 text-sm font-semibold">
                        {form.getValues("email")} is now on the list! 🎉
                      </p>
                      <p className="text-muted-foreground text-xs">
                        We'll notify you when we launch.
                      </p>
                    </div>
                  ) : (
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-3"
                        aria-label="Early access signup form"
                      >
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="sr-only">
                                Email address for early access
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type="email"
                                    className="pr-12 text-xs md:text-xs"
                                    placeholder="Curious? Enter your email for early access"
                                    autoComplete="email"
                                    aria-describedby="email-help"
                                    {...field}
                                  />
                                  <div id="email-help" className="sr-only">
                                    Enter your email to join the early access
                                    waitlist. Press "/" to focus this field.
                                  </div>
                                  <Button
                                    type="submit"
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Submit early access signup"
                                    disabled={
                                      form.formState.isSubmitting ||
                                      !field.value?.trim() ||
                                      !form.formState.isValid
                                    }
                                    className="hover:bg-muted absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 p-0"
                                  >
                                    {form.formState.isSubmitting ? (
                                      <div
                                        className="border-muted-foreground h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                                        aria-label="Submitting..."
                                      />
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
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Logo - Always visible and acts as anchor point in bottom row */}
        <Button
          ref={logoButtonRef}
          className={`absolute bottom-8 left-4 z-20 cursor-pointer rounded-full transition-all duration-500 ease-out ${
            isExpanded ? "opacity-80" : "opacity-100 hover:scale-110"
          }`}
          aria-label={
            isExpanded ? "Close early access chat" : "Open early access chat"
          }
          aria-expanded={isExpanded}
          onClick={() => {
            // If user manually opens, disable auto-scroll-close
            if (!isExpanded) {
              wasAutoExpanded.current = false;
              markUserAsOnboarded();
            }
            setIsExpanded((prev) => !prev);
          }}
          variant="outline"
          size="icon"
        >
          <Icons.logoShort className="h-6 w-6 text-white" />
        </Button>
      </div>
    </div>
  );
}
