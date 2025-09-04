"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { CalendarIcon, Clock, Key, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { Calendar as CalendarComponent } from "@repo/ui/components/ui/calendar";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { cn } from "@repo/ui/lib/utils";
import { format } from "date-fns";

import {
  createApiKeySchema,
  type CreateApiKeyFormData,
  EXPIRATION_OPTIONS,
  calculateExpirationDate,
  formatExpirationDate,
} from "./validation-schema";

interface CreateKeyFormProps {
  onSubmit: (data: CreateApiKeyFormData) => Promise<void>;
  isLoading?: boolean;
  onCancel?: () => void;
}

export function CreateKeyForm({ onSubmit, isLoading = false, onCancel }: CreateKeyFormProps) {
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

  const form = useForm<CreateApiKeyFormData>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: {
      name: "",
      expiration: "90d", // Default to 90 days for security
      customExpirationDate: undefined,
    },
  });

  const watchExpiration = form.watch("expiration");
  const watchCustomDate = form.watch("customExpirationDate");
  const watchName = form.watch("name");

  // Calculate preview expiration
  const previewExpiration = calculateExpirationDate(watchExpiration, watchCustomDate);

  const handleFormSubmit = async (data: CreateApiKeyFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      // Error handling is done by the parent component
      console.error("Form submission error:", error);
    }
  };

  const isCustomExpiration = watchExpiration === "custom";

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Key Name Field */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">API Key Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g., Production API Key"
                    disabled={isLoading}
                    className="h-10"
                    maxLength={100}
                  />
                </FormControl>
                <FormDescription>
                  Choose a descriptive name to help you identify this key later.
                  {watchName && (
                    <span className="block text-xs text-muted-foreground mt-1">
                      {watchName.length}/100 characters
                    </span>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Expiration Field */}
          <FormField
            control={form.control}
            name="expiration"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Expiration</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select expiration" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EXPIRATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Recommended: Set an expiration date for better security.
                  {previewExpiration && (
                    <span className="block text-xs font-medium mt-1">
                      Expires: {formatExpirationDate(previewExpiration)}
                    </span>
                  )}
                  {!previewExpiration && watchExpiration === "never" && (
                    <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ This key will never expire. Consider setting an expiration for security.
                    </span>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Custom Date Field - Only shown when custom is selected */}
          {isCustomExpiration && (
            <FormField
              control={form.control}
              name="customExpirationDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Custom Expiration Date</FormLabel>
                  <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-10 justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isLoading}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(new Date(field.value), "PPP")
                          ) : (
                            "Select expiration date"
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => {
                          field.onChange(date?.toISOString().split('T')[0]);
                          setIsCustomDateOpen(false);
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const maxDate = new Date();
                          maxDate.setFullYear(today.getFullYear() + 5);
                          return date <= today || date > maxDate;
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Select a future date up to 5 years from now.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !form.formState.isValid}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating Key...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Create API Key
                </>
              )}
            </Button>
          </div>

          {/* Form Validation Summary */}
          {form.formState.errors && Object.keys(form.formState.errors).length > 0 && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive">
                Please fix the following errors before continuing:
                <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                  {Object.entries(form.formState.errors).map(([field, error]) => (
                    <li key={field}>
                      <strong className="capitalize">{field}:</strong> {
                        typeof error === 'object' && error !== null && 'message' in error 
                          ? String(error.message)
                          : String(error)
                      }
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </form>
      </Form>
    </div>
  );
}