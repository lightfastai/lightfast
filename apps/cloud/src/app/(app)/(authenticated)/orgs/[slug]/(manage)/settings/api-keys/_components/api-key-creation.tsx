"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogDescription 
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Progress } from "@repo/ui/components/ui/progress";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { 
  ArrowLeft, 
  X, 
  AlertTriangle, 
  Key, 
  Copy, 
  Check, 
  Loader2,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "~/trpc/react";
import { 
  createApiKeySchema,
  EXPIRATION_OPTIONS,
  type CreateApiKeyFormData,
  type CreatedApiKey,
  type DialogStep
} from "./api-keys.types";
import { 
  calculateExpirationDate
} from "./api-keys.utils";

interface ApiKeyCreationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyCreated?: () => void;
}

export function ApiKeyCreation({ 
  open, 
  onOpenChange, 
  onKeyCreated 
}: ApiKeyCreationProps) {
  const [currentStep, setCurrentStep] = useState<DialogStep>("form");
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [isKeyCopied, setIsKeyCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trpc = useTRPC();
  
  const createKeyMutation = useMutation(
    trpc.apiKey.create.mutationOptions({
      onSuccess: (data: any) => {
        setError(null);
        setCreatedKey(data);
        setCurrentStep("display");
        toast.success("API key created!", {
          description: `"${data.name}" has been created successfully.`,
        });
      },
      onError: (error: any) => {
        setError(error.message || "Failed to create API key. Please try again.");
        toast.error("Failed to create API key", {
          description: error.message || "An unexpected error occurred.",
        });
      },
    })
  );

  const form = useForm<CreateApiKeyFormData>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      name: "",
      expiration: "never",
      customExpirationDate: "",
    },
  });

  const handleFormSubmit = useCallback(async (formData: CreateApiKeyFormData) => {
    try {
      setError(null);
      
      const expiresAt = calculateExpirationDate(
        formData.expiration,
        formData.customExpirationDate
      );
      
      await createKeyMutation.mutateAsync({
        name: formData.name,
        ...(expiresAt && { 
          expiresInDays: Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) 
        }),
      });
      
    } catch (error) {
      console.error("API key creation failed:", error);
    }
  }, [createKeyMutation]);

  const handleKeyCopied = useCallback(() => {
    setIsKeyCopied(true);
  }, []);

  const handleComplete = useCallback(() => {
    onOpenChange(false);
    onKeyCreated?.();
    resetDialogState();
  }, [onOpenChange, onKeyCreated]);

  const resetDialogState = useCallback(() => {
    setCurrentStep("form");
    setCreatedKey(null);
    setIsKeyCopied(false);
    setError(null);
    form.reset();
  }, [form]);

  const handleCancel = useCallback(() => {
    if (currentStep === "display" && createdKey && !isKeyCopied) {
      const confirmClose = window.confirm(
        "Are you sure you want to close? You haven't copied your API key yet and won't be able to see it again."
      );
      if (!confirmClose) {
        return;
      }
    }
    
    onOpenChange(false);
    setTimeout(resetDialogState, 200);
  }, [currentStep, createdKey, isKeyCopied, onOpenChange, resetDialogState]);

  const handleBackToForm = useCallback(() => {
    if (currentStep === "display") {
      setCurrentStep("form");
      setCreatedKey(null);
      setError(null);
    }
  }, [currentStep]);

  const getProgress = () => {
    switch (currentStep) {
      case "form": return 50;
      case "display": return 100;
      default: return 0;
    }
  };

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
      default:
        return { title: "", description: "" };
    }
  };

  const stepInfo = getStepInfo();
  const isLoading = createKeyMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
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
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Step {currentStep === "form" ? "1" : "2"} of 2</span>
              <span>{getProgress()}% complete</span>
            </div>
            <Progress value={getProgress()} className="h-2" />
          </div>
        </DialogHeader>

        {error && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="py-4">
          {currentStep === "form" && (
            <CreateKeyForm
              form={form}
              onSubmit={handleFormSubmit}
              isLoading={isLoading}
              onCancel={handleCancel}
            />
          )}

          {currentStep === "display" && createdKey && (
            <KeyDisplay
              apiKey={createdKey.key}
              onKeyCopied={handleKeyCopied}
            />
          )}
        </div>

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
              onClick={handleComplete}
              disabled={!isKeyCopied}
              className="ml-4"
            >
              Done
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

// Form component
function CreateKeyForm({ 
  form, 
  onSubmit, 
  isLoading, 
  onCancel 
}: {
  form: any;
  onSubmit: (data: CreateApiKeyFormData) => void;
  isLoading: boolean;
  onCancel: () => void;
}) {
  const watchExpiration = form.watch("expiration");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* API Key Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          API Key Name
        </Label>
        <Input
          id="name"
          placeholder="e.g., Production API Key"
          {...form.register("name")}
          className={form.formState.errors.name ? "border-red-500" : ""}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-600">
            {form.formState.errors.name.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Choose a descriptive name to help you identify this key later.
        </p>
      </div>

      {/* Expiration */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Expiration</Label>
        <Select 
          value={watchExpiration} 
          onValueChange={(value) => form.setValue("expiration", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select expiration" />
          </SelectTrigger>
          <SelectContent>
            {EXPIRATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {watchExpiration === "custom" && (
          <div className="space-y-2">
            <Label htmlFor="customExpirationDate" className="text-sm">
              Custom Expiration Date
            </Label>
            <Input
              id="customExpirationDate"
              type="datetime-local"
              {...form.register("customExpirationDate")}
              className={form.formState.errors.customExpirationDate ? "border-red-500" : ""}
            />
            {form.formState.errors.customExpirationDate && (
              <p className="text-sm text-red-600">
                {form.formState.errors.customExpirationDate.message}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          API keys with expiration dates are more secure. Choose "Never" only if necessary.
        </p>
      </div>


      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !form.formState.isValid}
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Key className="size-4 mr-2" />
              Create API Key
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// Key display component
function KeyDisplay({ 
  apiKey, 
  onKeyCopied 
}: {
  apiKey: string;
  onKeyCopied: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">("idle");
  const [showKey, setShowKey] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopyKey = useCallback(async () => {
    // Prevent multiple simultaneous copy operations
    if (copyState === "copying") return;

    setCopyState("copying");
    
    try {
      // Modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(apiKey);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = apiKey;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const success = document.execCommand("copy");
        document.body.removeChild(textArea);
        
        if (!success) {
          throw new Error("Copy command failed");
        }
      }
      
      // Success - show success state
      setCopyState("copied");
      onKeyCopied();
      
      // Show success toast
      toast.success("API key copied to clipboard!", {
        description: "The API key has been copied to your clipboard.",
      });
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set new timeout to reset state
      timeoutRef.current = setTimeout(() => {
        setCopyState("idle");
        timeoutRef.current = null;
      }, 2000); // Reduced to 2 seconds for better UX
      
    } catch (error) {
      setCopyState("idle");
      toast.error("Failed to copy API key", {
        description: "Please copy the key manually.",
      });
    }
  }, [apiKey, onKeyCopied]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getCopyButtonContent = () => {
    switch (copyState) {
      case "copying":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Copying...
          </>
        );
      case "copied":
        return (
          <>
            <Check className="h-4 w-4" />
            Copied!
          </>
        );
      default:
        return (
          <>
            <Copy className="h-4 w-4" />
            Copy Key
          </>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* API Key Display */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Your API Key</Label>
        <div className="relative">
          <div className="flex items-center p-3 bg-muted border rounded-md font-mono text-sm">
            <Key className="size-4 text-muted-foreground mr-3 shrink-0" />
            <code className="flex-1 break-all">
              {showKey ? apiKey : `${"•".repeat(12)}${apiKey.slice(-4)}`}
            </code>
            <div className="flex items-center gap-2 ml-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKey(!showKey)}
                className="h-8 w-8 p-0"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                onClick={handleCopyKey}
                disabled={copyState === "copying"}
                size="sm"
                className="gap-2"
              >
                {getCopyButtonContent()}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}