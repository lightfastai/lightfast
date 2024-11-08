import type { FieldPath } from "react-hook-form";
import type { z } from "zod";
import { useCallback, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { Value } from "@repo/webgl";
import { Form } from "@repo/ui/components/ui/form";
import { Separator } from "@repo/ui/components/ui/separator";

import type { Texture } from "./texture/types";
import { TDxMachineContext } from "./machine/context";
import { TDxFormField } from "./td-x-form-field";
import { $TextureUniforms } from "./texture/schema";

export const TDxTexturePropertyInspector = () => {
  const texture = TDxMachineContext.useSelector((state) =>
    state.context.textures.find(
      (m) => m.id === state.context.selectedProperty?.id,
    ),
  );

  if (!texture) return <TDxMaterialPropertyInspectorLoading />;

  return <TDxMaterialPropertyInspectorForm texture={texture} />;
};

export const TDxMaterialPropertyInspectorLoading = () => {
  return <div>Loading...</div>;
};

export const TDxMaterialPropertyInspectorForm = ({
  texture,
}: {
  texture: Texture;
}) => {
  const machineRef = TDxMachineContext.useActorRef();
  const form = useForm<z.infer<typeof $TextureUniforms>>({
    resolver: zodResolver($TextureUniforms),
    defaultValues: texture.uniforms,
  });

  useEffect(() => {
    form.reset(texture.uniforms);
  }, [texture, form.reset, form]);

  const handleUpdate = useCallback(
    (property: keyof z.infer<typeof $TextureUniforms>, value: Value) => {
      machineRef.send({
        type: "UPDATE_TEXTURE_UNIFORMS",
        textureId: texture.id,
        value: {
          [property]: value,
        },
      });
    },
    [texture.id, machineRef],
  );

  return (
    <div>
      <div className="flex items-center justify-between p-4">
        <h2 className="font-mono text-sm font-bold uppercase tracking-widest">
          Properties
        </h2>
        <h3 className="font-mono text-sm font-bold uppercase tracking-widest">
          {texture.type}
        </h3>
      </div>
      <Separator />
      <Form {...form}>
        <form className="flex flex-col space-y-2 py-2">
          {Object.entries(texture.uniforms).map(([property]) => (
            <TDxFormField
              key={property}
              label={property}
              control={form.control}
              parentSchema={$TextureUniforms}
              name={property as FieldPath<z.infer<typeof $TextureUniforms>>}
              onValueChange={(value) =>
                handleUpdate(
                  property as keyof z.infer<typeof $TextureUniforms>,
                  value,
                )
              }
            />
          ))}
        </form>
      </Form>
    </div>
  );
};
