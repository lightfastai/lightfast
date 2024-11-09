"use client";

import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

import { SignUpDialog } from "./sign-up-dialog";

export function TextureGenerationForm() {
  const [showSignUpDialog, setShowSignUpDialog] = useState(false);

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSignUpDialog(true);
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
          className="pr-12 text-sm transition-all duration-200 ease-in-out sm:text-base"
          aria-label="Texture generation prompt"
        />
        <div className="absolute right-0 top-0">
          <Button
            type="submit"
            variant="outline"
            size="icon"
            aria-label="Generate texture"
          >
            <ArrowRightIcon className="h-4 w-4" />
            <span className="sr-only">Submit generation request</span>
          </Button>
        </div>
      </form>

      <SignUpDialog
        open={showSignUpDialog}
        onOpenChange={setShowSignUpDialog}
      />
    </>
  );
}
