import { useRef, useState } from "react";
import { Send, X } from "lucide-react";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area";

import type { CommandDialogProps } from "./types";

export const GeneratorDialog = ({
  isOpen,
  onClose,
  onSubmit,
  suggestedPrompts,
  isGenerating,
  generationLogs,
}: CommandDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSubmit(inputValue);
      setInputValue("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div className="bg-background/95 absolute inset-0" />
      <div
        ref={dialogRef}
        className="bg-background animate-in fade-in-0 zoom-in-95 relative z-50 w-full max-w-lg rounded-lg border shadow-lg"
      >
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="ring-offset-background absolute top-2 right-4 z-10 h-8 w-8 rounded-full opacity-70 transition-opacity hover:opacity-100"
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
              <p className="text-muted-foreground mb-8 max-w-md text-center">
                Hi, let's create something amazing together!
              </p>
            </>
          )}

          <div className="w-full">
            {!isGenerating && (
              <div className="flex flex-wrap justify-center gap-2 overflow-x-auto">
                <ScrollArea className="w-full rounded-md whitespace-nowrap">
                  <div className="flex w-max space-x-4 p-1">
                    {suggestedPrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        className="rounded-full text-xs"
                        size="sm"
                        onClick={() => {
                          setInputValue(prompt);
                          inputRef.current?.focus();
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

            <form onSubmit={handleSubmit} className="flex flex-col border-t">
              <div className="relative flex-row">
                <Input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Describe your node..."
                  className="border-muted bg-muted/30 z-1 w-full border-none pr-10 pl-4 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <div className="flex h-9 items-center gap-2 border-t px-4">
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
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
  );
};
