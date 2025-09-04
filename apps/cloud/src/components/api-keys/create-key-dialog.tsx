"use client";

import { useState, useCallback } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogDescription 
} from "@repo/ui/components/ui/dialog";
import { Progress } from "@repo/ui/components/ui/progress";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { AlertTriangle, ArrowLeft, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "sonner";

import { useTRPC } from "~/trpc/react";
import { CreateKeyForm } from "./create-key-form";
import { KeyDisplay } from "./key-display";
import { CreationSuccess } from "./creation-success";
import { 
  type CreateApiKeyFormData, 
  calculateExpirationDate 
} from "./validation-schema";

interface CreateKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyCreated?: () => void;
}

type DialogStep = "form" | "display" | "success";

interface CreatedApiKey {
  id: string;
  key: string;
  name: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export function CreateKeyDialog({ 
  open, 
  onOpenChange, 
  onKeyCreated 
}: CreateKeyDialogProps) {
  const [currentStep, setCurrentStep] = useState<DialogStep>("form");
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [isKeyCopied, setIsKeyCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = useTRPC();
  
  // Safe fallback if tRPC is not fully initialized
  const createKeyMutation = (api as any)?.apiKey?.create?.useMutation?.({
    onSuccess: (data: any) => {
      // Clear any previous errors
      setError(null);
      
      // Store the created key data
      setCreatedKey({
        id: data.id,
        key: data.key,
        name: data.name,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdAt: new Date(data.createdAt),
      });
      
      // Move to key display step
      setCurrentStep("display");
      
      // Show success toast
      toast.success("API key created!", {
        description: `"${data.name}" has been created successfully.`,
      });
    },
    onError: (error: any) => {
      setError(error.message || "Failed to create API key. Please try again.");
      
      // Show error toast
      toast.error("Failed to create API key", {
        description: error.message || "An unexpected error occurred.",
      });
    },
  });

  const handleFormSubmit = useCallback(async (formData: CreateApiKeyFormData) => {
    if (!createKeyMutation) {
      setError("API is not available. Please refresh the page and try again.");
      return;
    }

    try {
      setError(null);
      
      const expiresAt = calculateExpirationDate(
        formData.expiration,
        formData.customExpirationDate
      );
      
      await createKeyMutation.mutateAsync({
        name: formData.name,
        expiresAt: expiresAt?.toISOString() || null,
      });
      
    } catch (error) {
      console.error("API key creation failed:", error);
      // Error handling is done by the mutation's onError
    }
  }, [createKeyMutation]);

  const handleKeyCopied = useCallback(() => {
    setIsKeyCopied(true);
  }, []);

  const handleContinueToSuccess = useCallback(() => {
    setCurrentStep("success");
  }, []);

  const handleComplete = useCallback(() => {
    // Close dialog
    onOpenChange(false);
    
    // Notify parent component
    onKeyCreated?.();
    
    // Reset state for next time
    resetDialogState();
  }, [onOpenChange, onKeyCreated]);

  const resetDialogState = useCallback(() => {
    setCurrentStep("form");
    setCreatedKey(null);
    setIsKeyCopied(false);
    setError(null);
  }, []);

  const handleCancel = useCallback(() => {
    if (currentStep === "display" && createdKey && !isKeyCopied) {
      // Show warning if user hasn't copied the key yet
      const confirmClose = window.confirm(
        "Are you sure you want to close? You haven't copied your API key yet and won't be able to see it again."
      );
      if (!confirmClose) {
        return;
      }
    }
    
    onOpenChange(false);
    // Reset state after a brief delay to allow dialog animation
    setTimeout(resetDialogState, 200);
  }, [currentStep, createdKey, isKeyCopied, onOpenChange, resetDialogState]);

  const handleBackToForm = useCallback(() => {
    // Only allow going back to form from display step
    if (currentStep === "display") {
      setCurrentStep("form");
      setCreatedKey(null);
      setError(null);
    }
  }, [currentStep]);

  // Calculate progress based on current step
  const getProgress = () => {
    switch (currentStep) {
      case "form": return 33;
      case "display": return 66;
      case "success": return 100;
      default: return 0;
    }
  };

  // Get step title and description
  const getStepInfo = () => {
    switch (currentStep) {
      case "form":
        return {
          title: "Create API Key",
          description: "Configure your new API key with a name and expiration."
        };
      case "display":
        return {
          title: "Your API Key",
          description: "Copy your API key now - you won't be able to see it again."
        };
      case "success":
        return {
          title: "Setup Complete",
          description: "Your API key is ready to use. Here's what you can do next."
        };
      default:
        return { title: "", description: "" };
    }
  };

  const stepInfo = getStepInfo();
  const isLoading = createKeyMutation?.isPending ?? false;

  // Don't render if API is not available
  if (!(api as any)?.apiKey?.create) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>API Key Creation Unavailable</DialogTitle>
            <DialogDescription>
              API key creation is not available right now.
            </DialogDescription>
          </DialogHeader>
          
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              The API key service is currently unavailable. Please refresh the page and try again.
            </AlertDescription>
          </Alert>
          
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          // Prevent closing on outside click during key display step if not copied
          if (currentStep === "display" && createdKey && !isKeyCopied) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="relative">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg">{stepInfo.title}</DialogTitle>
              <DialogDescription className="text-sm">
                {stepInfo.description}
              </DialogDescription>
            </div>
            
            {/* Back button for display step */}
            {currentStep === "display" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToForm}
                className="mr-2"
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Step {currentStep === "form" ? "1" : currentStep === "display" ? "2" : "3"} of 3</span>
              <span>{getProgress()}% complete</span>
            </div>
            <Progress value={getProgress()} className="h-2" />
          </div>
        </DialogHeader>

        {/* Error Alert */}
        {error && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        <div className="py-4">
          {currentStep === "form" && (
            <CreateKeyForm
              onSubmit={handleFormSubmit}
              isLoading={isLoading}
              onCancel={handleCancel}
            />
          )}

          {currentStep === "display" && createdKey && (
            <KeyDisplay
              apiKey={createdKey.key}
              keyName={createdKey.name}
              keyId={createdKey.id}
              expiresAt={createdKey.expiresAt}
              createdAt={createdKey.createdAt}
              onKeyCopied={handleKeyCopied}
            />
          )}

          {currentStep === "success" && createdKey && (
            <CreationSuccess
              keyName={createdKey.name}
              keyId={createdKey.id}
              wasKeyCopied={isKeyCopied}
              onComplete={handleComplete}
              onViewDocumentation={() => {
                // TODO: Open documentation in new tab
                window.open("/docs/api", "_blank");
              }}
              onSetupCLI={() => {
                // TODO: Open CLI setup guide in new tab
                window.open("/docs/cli", "_blank");
              }}
            />
          )}
        </div>

        {/* Footer Actions for Display Step */}
        {currentStep === "display" && createdKey && (
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              {isKeyCopied ? (
                <span className="text-green-600 dark:text-green-400">✓ Key copied to clipboard</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">⚠️ Copy your key before continuing</span>
              )}
            </div>
            <Button 
              onClick={handleContinueToSuccess}
              disabled={!isKeyCopied}
              className="ml-4"
            >
              Continue
              {!isKeyCopied && (
                <span className="ml-2 text-xs opacity-70">(Copy key first)</span>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}