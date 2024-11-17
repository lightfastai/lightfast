import { useCallback, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { Value } from "@repo/webgl";
import { Form } from "@repo/ui/components/ui/form";
import { Separator } from "@repo/ui/components/ui/separator";

import type { Geometry } from "../app/(app)/(stable)/(network-editor)/types/primitives";
import { NetworkEditorContext } from "~/app/(app)/(stable)/(network-editor)/state/context";
import { PropertyFormField } from "../app/(app)/(stable)/(network-editor)/components/inspector/property-form-field";
import { $Geometry } from "../app/(app)/(stable)/(network-editor)/types/primitives.schema";

export const TDxGeometryPropertyInspector = () => {
  const geometry = NetworkEditorContext.useSelector((state) =>
    state.context.geometries.find(
      (g) => g.id === state.context.selectedProperty?.id,
    ),
  );

  if (!geometry) return <TDxGeometryPropertyInspectorLoading />;

  return <TDxGeometryPropertyInspectorForm geometry={geometry} />;
};

export const TDxGeometryPropertyInspectorLoading = () => {
  return <div>Loading...</div>;
};

export const TDxGeometryPropertyInspectorForm = ({
  geometry,
}: {
  geometry: Geometry;
}) => {
  const machineRef = NetworkEditorContext.useActorRef();
  const form = useForm<Geometry>({
    resolver: zodResolver($Geometry),
    defaultValues: {
      position: geometry.position,
      rotation: geometry.rotation,
      scale: geometry.scale,
    },
  });

  useEffect(() => {
    form.reset({
      position: geometry.position,
      rotation: geometry.rotation,
      scale: geometry.scale,
    });
  }, [geometry, form.reset, form]);

  const handleUpdate = useCallback(
    (property: keyof Geometry, value: Value) => {
      machineRef.send({
        type: "UPDATE_GEOMETRY",
        geometryId: geometry.id,
        value: {
          [property]: value,
        },
      });
    },
    [geometry.id, machineRef],
  );

  return (
    <div>
      <div className="flex items-center justify-between p-4">
        <h2 className="font-mono text-sm font-bold uppercase tracking-widest">
          Properties
        </h2>
        <h3 className="font-mono text-sm font-bold uppercase tracking-widest">
          {geometry.type}
        </h3>
      </div>
      <Separator />
      <Form {...form}>
        <form className="flex flex-col space-y-2 py-2">
          <div className="space-y-2 py-4">
            {(["position", "rotation", "scale"] as const).map((property) => (
              <PropertyFormField
                key={property}
                name={property}
                label={property}
                control={form.control}
                parentSchema={$Geometry}
                onValueChange={(value) => handleUpdate(property, value)}
              />
            ))}
          </div>
        </form>
      </Form>
    </div>
  );
};
