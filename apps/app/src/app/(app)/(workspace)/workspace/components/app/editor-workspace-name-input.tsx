"use client";

import type { FieldErrors } from "react-hook-form";
import type { z } from "zod";
import React, { useEffect } from "react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  useForm,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { toast } from "@repo/ui/hooks/use-toast";
import { UpdateNameWorkspaceSchema } from "@vendor/db/schema";

import type { WorkspaceUpdateName } from "../../hooks/use-workspace-update-name";
import type { RouterOutputs } from "~/trpc/server/index";
import { useGetWorkspace } from "../../hooks/use-get-workspace";
import { useWorkspaceUpdateName } from "../../hooks/use-workspace-update-name";

interface EditorWorkspaceNameInputProps {
  initialWorkspace: RouterOutputs["tenant"]["workspace"]["get"];
}

export const EditorWorkspaceNameInput = ({
  initialWorkspace,
}: EditorWorkspaceNameInputProps) => {
  const { data: workspace } = useGetWorkspace({
    id: initialWorkspace.id,
    initialData: initialWorkspace,
  });
  const { mutate } = useWorkspaceUpdateName();

  const form = useForm({
    schema: UpdateNameWorkspaceSchema,
    defaultValues: {
      name: initialWorkspace.name,
      id: initialWorkspace.id,
    },
  });

  // Reset form values when workspace data changes
  useEffect(() => {
    if (workspace?.name !== undefined) {
      form.reset({
        name: workspace.name,
        id: initialWorkspace.id,
      });
    }
  }, [workspace?.name, form, initialWorkspace.id]);

  const onSubmit = async (
    data: WorkspaceUpdateName,
    event?: React.BaseSyntheticEvent,
  ) => {
    // If values haven't changed, do nothing
    if (data.name === workspace?.name) {
      return;
    }

    // Submit the data
    mutate({ id: initialWorkspace.id, name: data.name });

    // Try to blur the input without using refs
    if (event) {
      // Prevent default form submission
      event.preventDefault();

      // Access the input element via the event
      const formElement = event.target as HTMLFormElement;
      const inputElement = formElement.elements.namedItem(
        "name",
      ) as HTMLInputElement;
      inputElement.blur();
    }
  };

  const onInvalid = (
    errors: FieldErrors<z.infer<typeof UpdateNameWorkspaceSchema>>,
  ) => {
    const nameError = errors.name?.message;
    // Show validation errors
    toast({
      title: "Invalid workspace name",
      description: nameError || "Validation failed",
    });
    // Keep input active for correction
  };

  const handleBlur = async () => {
    const isValid = await form.trigger("name");

    if (!isValid) {
      // Reset the input to previous value
      form.reset({
        name: workspace?.name ?? "",
        id: initialWorkspace.id,
      });
      form.clearErrors();
      toast({
        title: "Invalid workspace name",
        description: form.formState.errors.name?.message,
      });
      return;
    }

    const values = form.getValues();

    // If values haven't changed, do nothing
    if (values.name === workspace?.name) {
      return;
    }

    // Submit the data
    mutate({ id: initialWorkspace.id, name: values.name });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  onBlur={handleBlur}
                  // Disable the input until the workspace data is loaded
                  disabled={workspace?.name === undefined}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};
