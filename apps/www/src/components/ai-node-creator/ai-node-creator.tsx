"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area";

import { Icons } from "~/app/icons";

export function AiNodeCreator() {
  const [isHovered, setIsHovered] = useState(false);
  const [openCommand, setOpenCommand] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generationLogs, setGenerationLogs] = useState<
    { time: string; message: string }[]
  >([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const generationSteps = [
    "Building context...",
    "Scaffolding nodes...",
    "Configuring properties...",
    "Initializing shaders...",
    "Finalizing output...",
  ];

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenCommand((open) => !open);
      }

      if (e.key === "Escape" && openCommand) {
        setOpenCommand(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [openCommand]);

  useEffect(() => {
    if (openCommand && inputRef.current) {
      inputRef.current.focus();
    }
  }, [openCommand]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setOpenCommand(false);
      }
    };

    if (openCommand) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openCommand]);

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setGenerationStep((prev) => {
          if (prev < generationSteps.length - 1) {
            const timestamp = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            const nextStep = generationSteps[prev + 1] || "";

            // Check if this message already exists in the logs to prevent duplicates
            setGenerationLogs((logs) => {
              // Only add if message doesn't already exist
              const messageExists = logs.some(
                (log) => log.message === nextStep,
              );
              if (messageExists) {
                return logs;
              }
              return [
                ...logs,
                {
                  time: timestamp,
                  message: nextStep,
                },
              ];
            });

            return prev + 1;
          }
          clearInterval(interval);
          return prev;
        });
      }, 800);

      return () => clearInterval(interval);
    } else {
      setGenerationStep(0);
      setGenerationLogs([]);
    }
  }, [isGenerating, generationSteps.length]);

  useEffect(() => {
    // Scroll to bottom when new logs are added
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [generationLogs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setIsGenerating(true);
      // Add initial log entry with the prompt
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setGenerationLogs([
        {
          time: timestamp,
          message: `Processing: "${inputValue}"`,
        },
      ]);
      // Here you would typically call your AI generation function
      // For this example, we'll just simulate a delay
      setTimeout(() => {
        setIsGenerating(false);
        setOpenCommand(false);
        setInputValue("");
      }, 5000);
    }
  };

  const suggestedPrompts = [
    "Create a blur effect node",
    "Make a color grading node",
    "Generate a particle system node",
  ];

  return (
    <>
      <div
        className="relative h-full w-full overflow-hidden rounded-md border"
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
      >
        <div className="flex flex-col gap-4 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.1)_1px,transparent_0)] bg-[length:1rem_1rem] p-64 dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.1)_1px,transparent_0)]" />
        {isHovered && (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              Press{" "}
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>{" "}
              to create
            </p>
          </div>
        )}

        {openCommand && (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-background/95" />
            <div
              ref={dialogRef}
              className="relative z-50 w-full max-w-lg rounded-lg border shadow-lg animate-in fade-in-0 zoom-in-95"
            >
              <Button
                onClick={() => setOpenCommand(false)}
                variant="ghost"
                size="icon"
                className="absolute right-4 top-2 z-10 h-8 w-8 rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>

              <div className="flex flex-col items-center justify-center pt-12">
                {isGenerating ? (
                  <div className="mb-8 w-full">
                    <ScrollArea className="h-40 w-full">
                      <div className="gap-1 p-4 font-mono text-sm">
                        {generationLogs.map((log, index) => (
                          <div key={index} className="mb-1 text-left">
                            <span className="text-blue-500">[{log.time}]</span>
                            <span className="ml-2 text-green-500">-</span>
                            <span className="ml-2">{log.message}</span>
                          </div>
                        ))}
                        <div ref={logsEndRef} />
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <>
                    <div className="mb-8">
                      <Icons.logo className="size-6" />
                    </div>
                    <p className="mb-8 max-w-md text-center text-muted-foreground">
                      Hi, let's create something amazing together!
                    </p>
                  </>
                )}

                <div className="w-full">
                  {!isGenerating && (
                    <div className="flex flex-wrap justify-center gap-2 overflow-x-auto">
                      <ScrollArea className="w-full whitespace-nowrap rounded-md">
                        <div className="flex w-max space-x-4 p-1">
                          {suggestedPrompts.map((prompt) => (
                            <Button
                              key={prompt}
                              variant="outline"
                              className="rounded-full text-xs"
                              size="sm"
                              onClick={() => {
                                setInputValue(prompt);
                                if (inputRef.current) {
                                  inputRef.current.focus();
                                }
                              }}
                            >
                              {prompt}
                            </Button>
                          ))}
                          <ScrollBar orientation="horizontal" />
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  <form
                    onSubmit={handleSubmit}
                    className="flex flex-col border-t"
                  >
                    <div className="relative flex-row">
                      <Input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        placeholder="Describe your node..."
                        className="z-1 w-full border-none border-muted bg-muted/30 pl-4 pr-10 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div className="flex h-9 items-center gap-2 border-t px-4">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Icons.logo className="size-3" />
                      </p>
                      <Button
                        type="submit"
                        disabled={isGenerating || !inputValue.trim()}
                        className="absolute right-1 z-[1000] h-7 w-32 border"
                        variant="ghost"
                        size="icon"
                      >
                        <span className="font-mono text-xs">Submit</span>
                        <Send className="size-3" />
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
