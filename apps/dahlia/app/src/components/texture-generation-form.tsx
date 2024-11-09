"use client";

import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

import { api } from "~/trpc/react";
import { SignUpDialog } from "./sign-up-dialog";

export function TextureGenerationForm() {
  const { data: session } = api.auth.getSession.useQuery();
  const [showSignUpDialog, setShowSignUpDialog] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Only show sign up dialog if user is not authenticated
    if (!session) {
      setShowSignUpDialog(true);
      return;
    }

    // TODO: Handle texture generation for authenticated users
    console.log("Generate texture:", inputValue);
  };

  return (
    <>
      <form
        className="relative w-full max-w-xl px-4 sm:px-0"
        role="search"
        aria-label="Generate texture"
        onSubmit={handleGenerateSubmit}
      >
        <Input
          placeholder="Generate a cool texture..."
          className="pr-12 text-sm transition-all duration-200 ease-in-out focus:ring-2 focus:ring-primary/20 sm:text-base"
          aria-label="Texture generation prompt"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <div
          className={`absolute right-0 top-0 transition-all duration-200 ${
            inputValue.trim()
              ? "translate-x-0 opacity-100"
              : "translate-x-2 opacity-0"
          }`}
        >
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="hover:bg-primary/10"
            disabled={!inputValue.trim()}
            aria-label="Generate texture"
          >
            <ArrowRightIcon className="h-4 w-4" />
            <span className="sr-only">Submit generation request</span>
          </Button>
        </div>
      </form>

      <SignUpDialog
        open={showSignUpDialog && !session}
        onOpenChange={setShowSignUpDialog}
      />
    </>
  );
}
