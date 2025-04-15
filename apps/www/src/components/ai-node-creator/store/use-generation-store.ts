import { useEffect, useState } from "react";

import type { GenerationLog } from "../types";

export function useGenerationState() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generationLogs, setGenerationLogs] = useState<GenerationLog[]>([]);

  const generationSteps = [
    "Building context...",
    "Scaffolding nodes...",
    "Configuring properties...",
    "Initializing shaders...",
    "Finalizing output...",
  ];

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

            setGenerationLogs((logs) => {
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

  const startGeneration = (prompt: string) => {
    setIsGenerating(true);
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setGenerationLogs([
      {
        time: timestamp,
        message: `Processing: "${prompt}"`,
      },
    ]);

    // Simulate generation completion after 5 seconds
    setTimeout(() => {
      setIsGenerating(false);
    }, 5000);
  };

  return {
    isGenerating,
    generationStep,
    generationLogs,
    startGeneration,
    generationSteps,
  };
}
