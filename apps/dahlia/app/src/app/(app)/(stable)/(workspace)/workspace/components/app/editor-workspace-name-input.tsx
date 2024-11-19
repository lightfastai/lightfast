"use client";

import { useRef } from "react";

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
      name: workspace?.name ?? "",
      id,
    },
    values: {
      name: workspace?.name ?? "",
      id,
    },
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef<boolean>(false); // Ensure this is a MutableRefObject

  const onSubmit = (data: WorkspaceUpdateName) => {
    // If values haven't changed, do nothing
    if (data.name === workspace?.name) {
      return;
    }

    // Submit the data
    mutate({ id, name: data.name });

    // Set flag to skip the next blur event
    skipBlurRef.current = true;

    // Blur the input
    inputRef.current?.blur();
  };

  const onInvalid = () => {
    // Show validation errors
    toast({
      title: "Invalid workspace name",
      description: form.formState.errors.name?.message,
    });
    // Keep input active for correction
  };

  const handleBlur = async () => {
    if (skipBlurRef.current) {
      // Reset the flag and skip this blur handler
      skipBlurRef.current = false;
      return;
    }

    const isValid = await form.trigger();

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
                  ref={(e) => {
                    field.ref(e);
                    inputRef.current = e;
                  }}
                  variant="ghost"
                  onBlur={handleBlur}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};
