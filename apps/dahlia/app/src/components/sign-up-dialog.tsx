"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";

import { Icons } from "~/app/icons";

interface SignUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignUpDialog({ open, onOpenChange }: SignUpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Join Dahlia</DialogTitle>
          <DialogDescription className="text-center">
            Create an account to start generating beautiful textures
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="animate-fadeIn">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                // Add GitHub OAuth logic here
                console.log("GitHub sign in clicked");
              }}
            >
              <Icons.gitHub className="mr-2 h-4 w-4" />
              Continue with GitHub
            </Button>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </DialogContent>
    </Dialog>
  );
}
