import type { FieldPath } from "react-hook-form";
import type { z } from "zod";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Texture } from "@repo/db/schema";
import { Form } from "@repo/ui/components/ui/form";
import { Separator } from "@repo/ui/components/ui/separator";
import { $TextureUniforms } from "@repo/webgl";

import { api } from "~/trpc/react";
import { InspectorBase } from "./inspector-base";
import { PropertyFormField } from "./property-form-field";

export const InspectorTexture = ({ id }: { id: string }) => {
  const [data] = api.node.data.get.useSuspenseQuery<Texture>({ id });
  const form = useForm<z.infer<typeof $TextureUniforms>>({
    resolver: zodResolver($TextureUniforms),
    defaultValues: data.uniforms,
  });

  useEffect(() => {
    form.reset(data.uniforms);
  }, [data, form.reset, form]);

  // const handleUpdate = useCallback(
  //   (property: keyof z.infer<typeof $TextureUniforms>, value: Value) => {
  //     machineRef.send({
  //       type: "UPDATE_TEXTURE_UNIFORMS",
  //       textureId: texture.id,
  //       value: {
  //         [property]: value,
  //       },
  //     });
  //   },
  //   [texture.id, machineRef],
  // );

  return (
    <InspectorBase>
      <div>
        <div className="flex items-center justify-between p-2">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest">
            Properties
          </h2>
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest">
            {data.type}
          </h3>
        </div>
        <Separator />
        <Form {...form}>
          <form className="flex flex-col space-y-2 py-2">
            {Object.entries(data.uniforms)
              .filter(([property]) => property !== "u_texture")
              .map(([property]) => (
                <PropertyFormField
                  key={property}
                  label={property}
                  control={form.control}
                  parentSchema={$TextureUniforms}
                  name={property as FieldPath<z.infer<typeof $TextureUniforms>>}
                  // onValueChange={(value) =>
                  //   handleUpdate(
                  //     property as keyof z.infer<typeof $TextureUniforms>,
                  //     value,
                  //   )
                  // }
                />
              ))}
          </form>
        </Form>
      </div>
    </InspectorBase>
  );
};
