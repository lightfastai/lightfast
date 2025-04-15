"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
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
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const [edgePositions, setEdgePositions] = useState<any[]>([]);

  const generationSteps = [
    "Building context...",
    "Scaffolding nodes...",
    "Configuring properties...",
    "Initializing shaders...",
    "Finalizing output...",
  ];

  // Define the edges between nodes (connections)
  const edges = [
    { from: 0, to: 1 }, // Node 1 to Node 2
    { from: 1, to: 2 }, // Node 2 to Node 3
    { from: 0, to: 3 }, // Node 1 to Node 4
    { from: 2, to: 3 }, // Node 3 to Node 4
  ];

  // Function to calculate edge positions
  const calculateEdgePositions = useCallback(() => {
    return edges
      .map((edge) => {
        const fromNode = nodeRefs.current[edge.from];
        const toNode = nodeRefs.current[edge.to];

        if (!fromNode || !toNode) return null;

        const fromRect = fromNode.getBoundingClientRect();
        const toRect = toNode.getBoundingClientRect();
        const containerRect = fromNode.parentElement?.getBoundingClientRect();

        if (!containerRect) return null;

        // Calculate positions relative to the container
        const fromX = fromRect.left + fromRect.width / 2 - containerRect.left;
        const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
        const toX = toRect.left + toRect.width / 2 - containerRect.left;
        const toY = toRect.top + toRect.height / 2 - containerRect.top;

        return {
          fromX,
          fromY,
          toX,
          toY,
          active:
            hoveredNodeIndex === edge.from || hoveredNodeIndex === edge.to,
        };
      })
      .filter(Boolean);
  }, [edges, hoveredNodeIndex]);

  // Update edge positions when nodes are hovered or on mount
  useEffect(() => {
    // Only calculate if nodes are all rendered
    if (nodeRefs.current.every((node) => node !== null)) {
      const positions = calculateEdgePositions();
      setEdgePositions(positions);
    }
  }, [hoveredNodeIndex, calculateEdgePositions]);

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      if (nodeRefs.current.every((node) => node !== null)) {
        const positions = calculateEdgePositions();
        setEdgePositions(positions);
      }
    };

    window.addEventListener("resize", handleResize);

    // Initial calculation
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [calculateEdgePositions]);

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
        className="relative h-[420px] w-full overflow-hidden rounded-md border"
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
      >
        <div className="relative flex h-full flex-wrap content-center justify-center gap-6 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.1)_1px,transparent_0)] bg-[length:1rem_1rem] p-6 dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.1)_1px,transparent_0)]">
          {/* SVG for edges */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ zIndex: 1 }}
          >
            {edgePositions.map(
              (edge, index) =>
                edge && (
                  <line
                    key={index}
                    x1={edge.fromX}
                    y1={edge.fromY}
                    x2={edge.toX}
                    y2={edge.toY}
                    stroke={
                      edge.active
                        ? "var(--sidebar-primary)"
                        : "var(--sidebar-border)"
                    }
                    strokeWidth={edge.active ? 2 : 1}
                    strokeDasharray={edge.active ? "none" : "4,4"}
                    strokeLinecap="round"
                  />
                ),
            )}
          </svg>

          {/* Node 1 */}
          <div
            ref={(el) => {
              nodeRefs.current[0] = el;
            }}
            className="relative aspect-[3/2] w-48 cursor-pointer overflow-hidden rounded-md border border-border/50 bg-background/80 p-2 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md hover:shadow-primary/10"
            onMouseEnter={() => setHoveredNodeIndex(0)}
            onMouseLeave={() => setHoveredNodeIndex(null)}
          >
            <Image
              src="/images/placeholder-node-1.jpg"
              alt="Node 1"
              width={300}
              height={200}
              className={`h-full w-full border border-border/50 object-cover transition-transform duration-500 ${hoveredNodeIndex === 0 ? "scale-110" : "scale-100"}`}
            />
          </div>

          {/* Node 2 */}
          <div
            ref={(el) => {
              nodeRefs.current[1] = el;
            }}
            className="relative aspect-[3/2] w-48 cursor-pointer overflow-hidden rounded-md border border-border/50 bg-background/80 p-2 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md hover:shadow-primary/10"
            onMouseEnter={() => setHoveredNodeIndex(1)}
            onMouseLeave={() => setHoveredNodeIndex(null)}
          >
            <Image
              src="/images/placeholder-node-2.jpg"
              alt="Node 2"
              width={300}
              height={200}
              className={`h-full w-full border border-border/50 object-cover transition-transform duration-500 ${hoveredNodeIndex === 1 ? "scale-110" : "scale-100"}`}
            />
          </div>

          {/* Node 3 */}
          <div
            ref={(el) => {
              nodeRefs.current[2] = el;
            }}
            className="relative aspect-[3/2] w-48 cursor-pointer overflow-hidden rounded-md border border-border/50 bg-background/80 p-2 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md hover:shadow-primary/10"
            onMouseEnter={() => setHoveredNodeIndex(2)}
            onMouseLeave={() => setHoveredNodeIndex(null)}
          >
            <Image
              src="/images/placeholder-node-3.jpg"
              alt="Node 3"
              width={300}
              height={200}
              className={`h-full w-full border border-border/50 object-cover transition-transform duration-500 ${hoveredNodeIndex === 2 ? "scale-110" : "scale-100"}`}
            />
          </div>

          {/* Node 4 */}
          <div
            ref={(el) => {
              nodeRefs.current[3] = el;
            }}
            className="relative aspect-[3/2] w-48 cursor-pointer overflow-hidden rounded-md border border-border/50 bg-background/80 p-2 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md hover:shadow-primary/10"
            onMouseEnter={() => setHoveredNodeIndex(3)}
            onMouseLeave={() => setHoveredNodeIndex(null)}
          >
            <Image
              src="/images/placeholder-node-4.jpg"
              alt="Node 4"
              width={300}
              height={200}
              className={`h-full w-full border border-border/50 object-cover transition-transform duration-500 ${hoveredNodeIndex === 3 ? "scale-110" : "scale-100"}`}
            />
          </div>
        </div>
        {isHovered && (
          <div className="absolute right-4 top-4 z-10">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setOpenCommand(true)}
            >
              Press{" "}
              <kbd className="ml-1 mr-1 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>{" "}
              to create
            </Button>
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
