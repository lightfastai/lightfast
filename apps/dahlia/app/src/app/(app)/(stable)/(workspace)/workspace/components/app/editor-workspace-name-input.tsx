"use client";

import React, { useEffect } from "react";

import { RouterOutputs } from "@repo/api";
import { UpdateNameWorkspaceSchema } from "@repo/db/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  useForm,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { toast } from "@repo/ui/hooks/use-toast";

import { useGetWorkspace } from "../../hooks/use-get-workspace";
import {
  useUpdateWorkspaceName,
  WorkspaceUpdateName,
} from "../../hooks/use-update-workspace-name";

interface EditorWorkspaceNameInputProps {
  id: RouterOutputs["workspace"]["get"]["id"];
}

export const EditorWorkspaceNameInput = ({
  id,
}: EditorWorkspaceNameInputProps) => {
  const { data: workspace } = useGetWorkspace({ id });
  const { mutate } = useUpdateWorkspaceName();

  const form = useForm({
    schema: UpdateNameWorkspaceSchema,
    defaultValues: {
      name: "",
      id,
    },
  });

  // Reset form values when workspace data changes
  useEffect(() => {
    if (workspace?.name !== undefined) {
      form.reset({
        name: workspace.name,
        id,
      });
    }
  }, [workspace?.name, form, id]);

  const onSubmit = async (
    data: WorkspaceUpdateName,
    event?: React.BaseSyntheticEvent,
  ) => {
    // If values haven't changed, do nothing
    if (data.name === workspace?.name) {
      return;
    }

    // Submit the data
    mutate({ id, name: data.name });

    // Try to blur the input without using refs
    if (event) {
      // Prevent default form submission
      event.preventDefault();

      // Access the input element via the event
      const formElement = event.target as HTMLFormElement;
      const inputElement = formElement.elements.namedItem(
        "name",
      ) as HTMLInputElement;
      inputElement?.blur();
    }
  };

  const onInvalid = (errors: any) => {
    // Show validation errors
    toast({
      title: "Invalid workspace name",
      description: errors.name?.message || "Validation failed",
    });
    // Keep input active for correction
  };

  const handleBlur = async () => {
    const isValid = await form.trigger("name");

    if (!isValid) {
      // Reset the input to previous value
      form.reset({
        name: workspace?.name ?? "",
        id,
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
    mutate({ id, name: values.name });
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
                  variant="ghost"
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
