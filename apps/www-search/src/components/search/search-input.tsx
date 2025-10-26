"use client";

import { useState, useRef } from "react";
import type { FormEvent } from "react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit
  
  
} from "@repo/ui/components/ai-elements/prompt-input";
import type {PromptInputMessage, PromptInputRef} from "@repo/ui/components/ai-elements/prompt-input";
import { cn } from "@repo/ui/lib/utils";

type SearchContext = "code" | "company" | "docs";

export function SearchInput() {
  const [selectedContext, setSelectedContext] = useState<SearchContext>("code");
  const formRef = useRef<PromptInputRef | null>(null);

  const contexts = [
    { id: "code" as const, label: "Code" },
    { id: "company" as const, label: "Company" },
    { id: "docs" as const, label: "Docs" },
  ];

  const handleSubmit = (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();
    const text = message.text ?? "";
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    console.log("Search:", { query: trimmedText, context: selectedContext });

    // Handle search submission here
    // TODO: Implement search logic

    // Clear form after submission
    if (formRef.current) {
      formRef.current.reset();
    }
  };

  const handleError = (err: {
    code: "max_files" | "max_file_size" | "accept" | "upload_failed";
    message: string;
  }) => {
    console.error("Prompt input error:", err);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PromptInput ref={formRef} onSubmit={handleSubmit} onError={handleError}>
        <PromptInputBody>
          <PromptInputTextarea
            placeholder={`Search ${selectedContext}...`}
            className="min-h-[90px]"
          />
        </PromptInputBody>

        <PromptInputToolbar>
          <PromptInputTools>
            {/* Context Selection Buttons */}
            {contexts.map((context) => {
              const isSelected = selectedContext === context.id;
              return (
                <PromptInputButton
                  key={context.id}
                  variant="ghost"
                  onClick={() => setSelectedContext(context.id)}
                  className={cn(
                    "gap-1.5 !rounded-full",
                    isSelected
                      ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {context.label}
                </PromptInputButton>
              );
            })}
          </PromptInputTools>

          <PromptInputSubmit className="rounded-full" />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
