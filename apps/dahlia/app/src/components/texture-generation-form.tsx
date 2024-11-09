"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

import { api } from "~/trpc/react";
import { SignUpDialog } from "./sign-up-dialog";

export function TextureGenerationForm() {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: session } = api.auth.getSession.useQuery();
  const [showSignUpDialog, setShowSignUpDialog] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const createProject = api.projects.create.useMutation({
    onSuccess: (data) => {
      if (data?.id) {
        console.log("Project created:", data);
        setInputValue("");
        utils.projects.getProjects.invalidate();
        router.push(`/chat/${data.id}`);
      }
    },
  });

  const generateRandomName = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from(
      { length: 12 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session) {
      setShowSignUpDialog(true);
      return;
    }

    try {
      setIsLoading(true);
      await createProject.mutateAsync({
        prompt: inputValue,
        status: "pending",
      });
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsLoading(false);
    }
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
          disabled={isLoading}
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
            disabled={!inputValue.trim() || isLoading}
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
