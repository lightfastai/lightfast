import type { FieldPath } from "react-hook-form";
import type { z } from "zod";
import { useCallback, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import type { Value } from "@repo/webgl";
import type { Txt2Img } from "@vendor/db/types";
import { Form } from "@repo/ui/components/ui/form";
import { Separator } from "@repo/ui/components/ui/separator";
import { $Txt2Img } from "@vendor/db/types";

import { useDebounce } from "~/hooks/use-debounce";
import { useTRPC } from "~/trpc/client/react";
import { InspectorBase } from "./inspector-base";
import { InspectorFormField } from "./inspector-form-field";

export const FluxInspector = ({ id }: { id: string }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(
    trpc.tenant.node.data.get.queryOptions<Txt2Img>({ id }),
  );

  const form = useForm<Txt2Img>({
    resolver: zodResolver($Txt2Img),
    defaultValues: data,
  });

  const { mutate: updateData } = useMutation(
    trpc.tenant.node.data.update.mutationOptions({
      onError: (error) => {
        // On error, revert the optimistic update
        queryClient.setQueryData(
          trpc.tenant.node.data.get.queryKey({ id }),
          data,
        );
      },
    }),
  );

  useEffect(() => {
    form.reset(data);
  }, [data, form.reset, form]);

  const debouncedServerUpdate = useDebounce((updates: Txt2Img) => {
    updateData({
      id,
      data: updates,
    });
  }, 500);

  const handleUpdate = useCallback(
    (property: keyof Txt2Img, value: Value) => {
      if (!value) return;

      // @TODO: fix this type
      const newUniforms = {
        ...data,
        [property]: value,
      } as Txt2Img;

      // Optimistically update the cache
      queryClient.setQueryData(trpc.tenant.node.data.get.queryKey({ id }), {
        type: data.type,
        prompt: newUniforms.prompt,
      });

      // Debounce the actual server update
      debouncedServerUpdate(newUniforms);
    },
    [data, queryClient, trpc.tenant.node.data.get, id, debouncedServerUpdate],
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
                  parentSchema={$Txt2Img}
                  name={property as FieldPath<z.infer<typeof $Txt2Img>>}
                  onValueChange={(value) =>
                    handleUpdate(property as keyof Txt2Img, value)
                  }
                />
              ))}
          </form>
        </Form>
      </div>
    </InspectorBase>
  );
};
