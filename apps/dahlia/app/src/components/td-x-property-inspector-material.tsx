import { useCallback, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { Color, Value } from "@repo/webgl";
import { Form } from "@repo/ui/components/ui/form";
import { Separator } from "@repo/ui/components/ui/separator";

import type { Material } from "./types";
import { TDxMachineContext } from "~/machine/context";
import { $Material } from "./schema";
import { TDxFormField } from "./td-x-form-field";

export const TDxMaterialPropertyInspector = () => {
  const material = TDxMachineContext.useSelector((state) =>
    state.context.materials.find(
      (m) => m.id === state.context.selectedProperty?.id,
    ),
  );

  if (!material) return <TDxMaterialPropertyInspectorLoading />;

  return <TDxMaterialPropertyInspectorForm material={material} />;
};

export const TDxMaterialPropertyInspectorLoading = () => {
  return <div>Loading...</div>;
};

export const TDxMaterialPropertyInspectorForm = ({
  material,
}: {
  material: Material;
}) => {
  const machineRef = TDxMachineContext.useActorRef();
  const form = useForm<Material>({
    resolver: zodResolver($Material),
    defaultValues: {
      color: material.color,
    },
  });

  useEffect(() => {
    form.reset({
      color: material.color,
    });
  }, [material, form.reset, form]);

  const handleUpdate = useCallback(
    (property: keyof Material, value: Value) => {
      machineRef.send({
        type: "UPDATE_MATERIAL",
        materialId: material.id,
        value: {
          [property]: value,
        },
      });
    },
    [material.id, machineRef],
  );

  return (
    <div>
      <div className="flex items-center justify-between p-4">
        <h2 className="font-mono text-sm font-bold uppercase tracking-widest">
          Properties
        </h2>
        <h3 className="font-mono text-sm font-bold uppercase tracking-widest">
          {material.type}
        </h3>
      </div>
      <Separator />
      <Form {...form}>
        <form className="flex flex-col space-y-2 py-2">
          <TDxFormField
            name={"color"}
            label={"Color"}
            control={form.control}
            parentSchema={$Material}
            onValueChange={(value) => handleUpdate("color", value as Color)}
          />
        </form>
      </Form>
    </div>
  );
};
