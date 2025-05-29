"use client";

import type * as z from "zod";
import { useEffect, useState } from "react";
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

  // Card expand/collapse state
  const [isExpanded, setIsExpanded] = useState(false);

  // Animated intro message states
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
    if (!isExpanded) {
      setMessages([]);
      setCurrentMessageIndex(0);
      setIsLoadingComplete(false);
      return;
    }
    if (currentMessageIndex >= INTRO_TEXTS.length) {
      setIsLoadingComplete(true);
      return;
    }
    const currentText = INTRO_TEXTS[currentMessageIndex];
    if (!currentText) return;
    const timer = setTimeout(() => {
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
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, isComplete: true } : msg,
          ),
        );
      }, 100);
      setTimeout(() => {
        setCurrentMessageIndex(currentMessageIndex + 1);
      }, 1200);
    }, 800);
    return () => clearTimeout(timer);
  }, [currentMessageIndex, isExpanded]);

  // Reset messages when card is closed
  useEffect(() => {
    if (!isExpanded) {
      setMessages([]);
      setCurrentMessageIndex(0);
      setIsLoadingComplete(false);
    }
  }, [isExpanded]);

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
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
      <div className="relative">
        {/* Expanding Card - always in DOM, class toggles for smooth transition */}
        <div
          className={`expanding-card ${isExpanded ? "expanded" : "collapsed"}`}
        >
          <Card className="w-108 shadow-xl backdrop-blur-sm">
            <CardContent className="space-y-4">
              {/* Header area with close button */}
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setIsExpanded(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Animated intro messages */}
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="text-sm">
                    <span
                      className={`transition-all duration-700 ease-out ${
                        message.isComplete
                          ? "opacity-100 blur-none"
                          : "opacity-70 blur-sm"
                      }`}
                    >
                      {message.content}
                      {!message.isComplete && (
                        <span className="ml-1 animate-pulse">|</span>
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
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Logo - Always visible and acts as anchor point in bottom row */}
        <Button
          className={`absolute bottom-8 left-4 z-20 cursor-pointer transition-all duration-500 ease-out ${
            isExpanded ? "opacity-80" : "opacity-100 hover:scale-110"
          }`}
          onClick={() => setIsExpanded((prev) => !prev)}
          variant="outline"
          size="icon"
        >
          <Icons.logoShort className="h-6 w-6 text-white" />
        </Button>
      </div>
    </div>
  );
}
