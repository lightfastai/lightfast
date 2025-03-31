"use client";

import type { FieldErrors } from "react-hook-form";
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

import type { WorkspaceUpdateName } from "../../hooks/use-workspace-update-name";
import type { UpdateNameWorkspace } from "~/db/schema/tables/Workspace";
import type { RouterOutputs } from "~/trpc/server/index";
import { UpdateNameWorkspaceSchema } from "~/db/schema/tables/Workspace";
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
      workspaceName: initialWorkspace.name,
      id: initialWorkspace.id,
    },
  });

  // Reset form values when workspace data changes
  useEffect(() => {
    if (workspace.name) {
      form.reset({
        workspaceName: workspace.name,
        id: initialWorkspace.id,
      });
    }
  }, [workspace.name, form, initialWorkspace.id]);

  const onSubmit = async (
    data: WorkspaceUpdateName,
    event?: React.BaseSyntheticEvent,
  ) => {
    // If values haven't changed, do nothing
    if (data.workspaceName === workspace.name) {
      return;
    }

    // Submit the data
    mutate({ id: initialWorkspace.id, workspaceName: data.workspaceName });

    // Try to blur the input without using refs
    if (event) {
      // Prevent default form submission
      event.preventDefault();

      // Access the input element via the event
      const formElement = event.target as HTMLFormElement;
      const inputElement = formElement.elements.namedItem(
        "workspaceName",
      ) as HTMLInputElement;
      inputElement.blur();
    }
  };

  const onInvalid = (errors: FieldErrors<UpdateNameWorkspace>) => {
    const nameError = errors.workspaceName?.message;
    // Show validation errors
    toast({
      title: "Invalid workspace name",
      description: nameError || "Validation failed",
    });
    // Keep input active for correction
  };

  const handleBlur = async () => {
    const isValid = await form.trigger("workspaceName");

    if (!isValid) {
      // Reset the input to previous value
      form.reset({
        workspaceName: workspace.name,
        id: initialWorkspace.id,
      });
      form.clearErrors();
      toast({
        title: "Invalid workspace name",
        description: form.formState.errors.workspaceName?.message,
      });
      return;
    }

    const values = form.getValues();

    // If values haven't changed, do nothing
    if (values.workspaceName === workspace.name) {
      return;
    }

    // Submit the data
    mutate({ id: initialWorkspace.id, workspaceName: values.workspaceName });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
        <FormField
          control={form.control}
          name="workspaceName"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  value={field.value}
                  onChange={field.onChange}
                  id="workspace-name"
                  type="text"
                  name={field.name}
                  placeholder="Workspace name"
                  onBlur={handleBlur}
                  // Disable the input until the workspace data is loaded
                  disabled={!workspace.name}
                  className="h-7 w-64 p-1.5 md:text-xs"
                />
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};
