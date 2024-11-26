import type { FieldPath } from "react-hook-form";
import type { z } from "zod";
import { useCallback, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { $TextureUniforms, Texture, TextureUniforms } from "@repo/db/schema";
import { Form } from "@repo/ui/components/ui/form";
import { Separator } from "@repo/ui/components/ui/separator";
import { Value } from "@repo/webgl";

import { useDebounce } from "~/hooks/use-debounce";
import { api } from "~/trpc/react";
import { InspectorBase } from "./inspector-base";
import { InspectorFormField } from "./inspector-form-field";

export const InspectorTexture = ({ id }: { id: string }) => {
  const utils = api.useUtils();
  const [data] = api.node.data.get.useSuspenseQuery<Texture>({ id });

  const form = useForm<TextureUniforms>({
    resolver: zodResolver($TextureUniforms),
    defaultValues: data.uniforms,
  });

  const { mutate: updateData } = api.node.data.update.useMutation({
    onError: () => {
      // On error, revert the optimistic update
      utils.node.data.get.setData({ id }, data);
    },
  });

  useEffect(() => {
    form.reset(data.uniforms);
  }, [data, form.reset, form]);

  const debouncedServerUpdate = useDebounce((updates: TextureUniforms) => {
    updateData({
      id,
      data: {
        type: data.type,
        uniforms: updates,
      },
    });
  }, 500);

  const handleUpdate = useCallback(
    (property: keyof TextureUniforms, value: Value) => {
      if (!value) return;
      if (property === "u_texture") return;

      // @TODO: fix this type
      const newUniforms = {
        ...data.uniforms,
        [property]: value,
      } as TextureUniforms;

      // Optimistically update the cache
      utils.node.data.get.setData(
        { id },
        {
          type: data.type,
          uniforms: newUniforms,
        },
      );

      // Debounce the actual server update
      debouncedServerUpdate(newUniforms);
    },
    [id, data.type, data.uniforms, utils.node.data.get, debouncedServerUpdate],
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
          <form className="flex flex-col pb-4 pt-2">
            {Object.entries(data.uniforms)
              .filter(([property]) => property !== "u_texture")
              .map(([property]) => (
                <InspectorFormField
                  key={property}
                  label={property}
                  control={form.control}
                  parentSchema={$TextureUniforms}
                  name={property as FieldPath<z.infer<typeof $TextureUniforms>>}
                  onValueChange={(value) =>
                    handleUpdate(property as keyof TextureUniforms, value)
                  }
                />
              ))}
          </form>
        </Form>
      </div>
    </InspectorBase>
  );
};
