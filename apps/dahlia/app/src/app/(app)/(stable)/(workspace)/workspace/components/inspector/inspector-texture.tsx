import type { FieldPath } from "react-hook-form";
import type { z } from "zod";
import { useCallback, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { $TextureUniforms, Texture, TextureUniforms } from "@repo/db/schema";
import { Form } from "@repo/ui/components/ui/form";
import { Separator } from "@repo/ui/components/ui/separator";
import { Value } from "@repo/webgl";

import { api } from "~/trpc/react";
import { InspectorBase } from "./inspector-base";
import { PropertyFormField } from "./property-form-field";

export const InspectorTexture = ({ id }: { id: string }) => {
  const [data] = api.node.data.get.useSuspenseQuery<Texture>({ id });
  const utils = api.useUtils();
  const { mutate: updateData } = api.node.data.update.useMutation({
    onSuccess: () => {
      // Invalidate the node data query to refresh the view
      utils.node.data.get.invalidate({ id });
      console.log("updated");
    },
  });

  const form = useForm<TextureUniforms>({
    resolver: zodResolver($TextureUniforms),
    defaultValues: data.uniforms,
  });

  useEffect(() => {
    form.reset(data.uniforms);
  }, [data, form.reset, form]);

  const handleUpdate = useCallback(
    (property: keyof TextureUniforms, value: Value) => {
      if (!value) return;
      if (property === "u_texture") return;
      updateData({
        id,
        data: {
          type: data.type,
          uniforms: {
            ...(data.uniforms as TextureUniforms),
            [property]: value,
          },
        },
      });
    },
    [id, updateData, data],
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
          <form className="flex flex-col space-y-2 py-4">
            {Object.entries(data.uniforms)
              .filter(([property]) => property !== "u_texture")
              .map(([property]) => (
                <PropertyFormField
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
