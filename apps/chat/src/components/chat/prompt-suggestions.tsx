"use client";

interface PromptSuggestionsProps {
  onSelectPrompt: (prompt: string) => void;
}

export function PromptSuggestions({ onSelectPrompt }: PromptSuggestionsProps) {
  // TODO: Define suggested prompts
  const suggestions = [
    "What can you help me with?",
    "Explain quantum computing",
    "Write a Python script",
    "Help me debug my code",
  ];

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {/* TODO: Render suggestion buttons */}
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          onClick={() => onSelectPrompt(suggestion)}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}