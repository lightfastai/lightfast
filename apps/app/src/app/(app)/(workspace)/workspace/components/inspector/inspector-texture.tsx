import type { FieldPath } from "react-hook-form";
import type { z } from "zod";
import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { getUniformConstraintsForType } from "node_modules/@repo/webgl/src/registry";
import { useForm } from "react-hook-form";

import type { Value } from "@repo/webgl";
import type { Texture, TextureUniforms } from "@vendor/db/types";
import { Form } from "@repo/ui/components/ui/form";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { $TextureUniforms } from "@vendor/db/types";

import { useDebounce } from "~/hooks/use-debounce";
import { api } from "~/trpc/client/react";
import { InspectorBase } from "./inspector-base";
import { InspectorFormField } from "./inspector-form-field";

export const InspectorTexture = ({ id }: { id: string }) => {
  const utils = api.useUtils();
  const [data] = api.tenant.node.data.get.useSuspenseQuery<Texture>({ id });

  const form = useForm<TextureUniforms>({
    resolver: zodResolver($TextureUniforms),
    defaultValues: data.uniforms,
    mode: "onBlur",
  });

  const [isFormReady, setIsFormReady] = useState(false);

  const { mutate: updateData } = api.tenant.node.data.update.useMutation({
    onError: () => {
      // On error, revert the optimistic update
      utils.tenant.node.data.get.setData({ id }, data);
    },
  });

  useEffect(() => {
    form.reset(data.uniforms);
    setIsFormReady(true);
  }, [data, form.reset, form]);

  const debouncedServerUpdate = useDebounce((updates: TextureUniforms) => {
    updateData({
      id,
      data: {
        type: data.type,
        uniforms: updates,
        resolution: data.resolution,
      },
    });
  }, 500);

  const handleUpdate = useCallback(
    (property: keyof TextureUniforms, value: Value) => {
      if (property === "u_texture") return;

      // @TODO: fix this type
      const newUniforms = {
        ...data.uniforms,
        [property]: value,
      } as TextureUniforms;

      // Optimistically update the cache
      utils.tenant.node.data.get.setData(
        { id },
        {
          type: data.type,
          uniforms: newUniforms,
          resolution: data.resolution,
        },
      );

      // Debounce the actual server update
      debouncedServerUpdate(newUniforms);
    },
    [
      data.uniforms,
      data.type,
      data.resolution,
      utils.tenant.node.data.get,
      id,
      debouncedServerUpdate,
    ],
  );

  if (!isFormReady) {
    return null;
  }

  return (
    <InspectorBase>
      <Tabs defaultValue="uniforms" className="flex flex-col">
        <div className="flex flex-col">
          <div className="flex items-center justify-end p-1.5">
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest">
              {data.type}
            </h3>
          </div>
          <Separator />
          <TabsList className="flex h-8 w-full rounded-none bg-background">
            <TabsTrigger
              value="uniforms"
              className="flex items-center justify-center"
            >
              <span className="font-mono text-xs tracking-widest">
                Uniforms
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="common"
              className="flex items-center justify-center"
            >
              <span className="font-mono text-xs tracking-widest">Common</span>
            </TabsTrigger>
          </TabsList>
          <Separator />
          <TabsContent value="uniforms" className="p-0">
            <Form {...form}>
              <form className="flex flex-col gap-1.5 px-1.5 py-1.5">
                {Object.entries(data.uniforms)
                  .filter(([property]) => !property.startsWith("u_texture"))
                  .map(([property]) => (
                    <InspectorFormField
                      key={property}
                      control={form.control}
                      parentSchema={$TextureUniforms}
                      name={
                        property as FieldPath<z.infer<typeof $TextureUniforms>>
                      }
                      onValueChange={(value) =>
                        handleUpdate(property as keyof TextureUniforms, value)
                      }
                      // @TODO: fix this. technically it should always be valid but in the definition
                      // of the getUniformConstraintsForType it can throw error....
                      constraints={getUniformConstraintsForType(data.type)}
                    />
                  ))}
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="common">
            <div className="flex flex-col gap-1.5 px-1.5 py-1.5">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-xs font-bold uppercase tracking-widest">
                  Resolution
                </h2>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </InspectorBase>
  );
};
