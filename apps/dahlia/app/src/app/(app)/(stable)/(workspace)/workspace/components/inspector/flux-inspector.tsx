import type { FieldPath } from "react-hook-form";
import type { z } from "zod";
import { useCallback, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { $Flux, Flux } from "@repo/db/schema";
import { Form } from "@repo/ui/components/ui/form";
import { Separator } from "@repo/ui/components/ui/separator";
import { Value } from "@repo/webgl";

import { useDebounce } from "~/hooks/use-debounce";
import { api } from "~/trpc/react";
import { InspectorBase } from "./inspector-base";
import { InspectorFormField } from "./inspector-form-field";

export const FluxInspector = ({ id }: { id: string }) => {
  const utils = api.useUtils();
  const [data] = api.node.data.get.useSuspenseQuery<Flux>({ id });

  const form = useForm<Flux>({
    resolver: zodResolver($Flux),
    defaultValues: data,
  });

  const { mutate: updateData } = api.node.data.update.useMutation({
    onError: () => {
      // On error, revert the optimistic update
      utils.node.data.get.setData({ id }, data);
    },
  });

  useEffect(() => {
    form.reset(data);
  }, [data, form.reset, form]);

  const debouncedServerUpdate = useDebounce((updates: Flux) => {
    updateData({
      id,
      data: updates,
    });
  }, 500);

  const handleUpdate = useCallback(
    (property: keyof Flux, value: Value) => {
      if (!value) return;

      // @TODO: fix this type
      const newUniforms = {
        ...data,
        [property]: value,
      } as Flux;

      // Optimistically update the cache
      utils.node.data.get.setData(
        { id },
        {
          type: data.type,
          prompt: newUniforms.prompt,
        },
      );

      // Debounce the actual server update
      debouncedServerUpdate(newUniforms);
    },
    [id, data, utils.node.data.get, debouncedServerUpdate],
  );

  return (
    <InspectorBase>
      <div>
        <div className="flex items-center justify-between p-4">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest">
            Properties
          </h2>
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest">
            {data.type}
          </h3>
        </div>
        <Separator />
        <Form {...form}>
          <form className="flex flex-col py-4">
            {Object.entries(data)
              .filter(([property]) => property !== "type")
              .map(([property]) => (
                <InspectorFormField
                  key={property}
                  label={property}
                  control={form.control}
                  parentSchema={$Flux}
                  name={property as FieldPath<z.infer<typeof $Flux>>}
                  onValueChange={(value) =>
                    handleUpdate(property as keyof Flux, value)
                  }
                />
              ))}
          </form>
        </Form>
      </div>
    </InspectorBase>
  );
};
