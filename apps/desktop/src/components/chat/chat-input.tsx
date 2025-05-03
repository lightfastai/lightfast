import { FormEvent } from "react";
import { Send } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function ChatInput({
  input,
  isLoading,
  handleInputChange,
  handleSubmit,
}: ChatInputProps) {
  return (
    <div className="border-border p-4">
      <div className="mx-auto max-w-2xl">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask me to do something in Blender..."
            disabled={isLoading}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground flex-1"
          />
          <Button
            type="submit"
            disabled={isLoading}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Send className="size-4" />
          </Button>
        </form>
        <div className="mt-2 text-center">
          <span className="text-muted-foreground text-xs">
            Lightfast Computer may make mistakes. Please use with discretion.
          </span>
        </div>
      </div>
    </div>
  );
}
