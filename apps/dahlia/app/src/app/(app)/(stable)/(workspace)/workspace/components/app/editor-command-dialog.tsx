"use client";

import { useEffect } from "react";
import { Circle, Square, Triangle } from "lucide-react";

import { $GeometryType, GeometryType } from "@repo/db/schema";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import { Label } from "@repo/ui/components/ui/label";

import { NetworkEditorContext } from "../../state/context";
import { $MaterialType } from "../../types/primitives.schema";
import { $TextureTypes } from "../../types/texture.schema";

export const EditorCommandDialog = () => {
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();

  /**
   * Handle geometry selection
   */
  const handleGeometrySelect = (geometryType: GeometryType) => {
    // Close the command dialog first
    machineRef.send({ type: "TOGGLE_COMMAND" });

    // Notify parent component of the selected geometry
    machineRef.send({
      type: "SELECT_GEOMETRY",
      geometry: geometryType,
    });
  };

  /**
   * Handle global command dialog toggle
   * @usage (CMD + K)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        machineRef.send({ type: "TOGGLE_COMMAND" });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      /**
       * CMD + Z
       */
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        machineRef.send({ type: "UNDO" });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      /**
       * CMD + SHIFT + Y
       */
      if ((e.metaKey || e.ctrlKey) && e.key === "y" && e.shiftKey) {
        e.preventDefault();
        machineRef.send({ type: "REDO" });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <CommandDialog
      open={state.context.isCommandOpen}
      onOpenChange={() => machineRef.send({ type: "TOGGLE_COMMAND" })}
    >
      <Command>
        <CommandInput placeholder="Search a TOP..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="WebGL Geometry">
            <CommandItem
              onSelect={() => handleGeometrySelect($GeometryType.Enum.box)}
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              <Label>Box</Label>
            </CommandItem>
            <CommandItem
              onSelect={() => handleGeometrySelect($GeometryType.Enum.sphere)}
              className="flex items-center gap-2"
            >
              <Circle className="h-4 w-4" />
              <Label>Sphere</Label>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                handleGeometrySelect($GeometryType.Enum.tetrahedron)
              }
              className="flex items-center gap-2"
            >
              <Triangle className="h-4 w-4" />
              <Label>Tetrahedron</Label>
            </CommandItem>
            <CommandItem
              onSelect={() => handleGeometrySelect($GeometryType.Enum.torus)}
              className="flex items-center gap-2"
            >
              <Circle className="h-4 w-4" />
              <Label>Torus</Label>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Material">
            <CommandItem
              onSelect={() =>
                machineRef.send({
                  type: "SELECT_MATERIAL",
                  material: $MaterialType.Enum.Phong,
                })
              }
            >
              <Label>Phong</Label>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="TOP">
            <CommandItem
              onSelect={() => {
                machineRef.send({
                  type: "SELECT_TEXTURE",
                  texture: $TextureTypes.Enum.Noise,
                });
              }}
              className="flex items-center gap-2"
            >
              <Label>Noise</Label>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                machineRef.send({
                  type: "SELECT_TEXTURE",
                  texture: $TextureTypes.Enum.Limit,
                });
              }}
              className="flex items-center gap-2"
            >
              <Label>Limit</Label>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Utilities">
            <CommandItem
              onSelect={() => {
                machineRef.send({ type: "CLEAR" });
              }}
              className="flex items-center gap-2"
            >
              <Label>Clear Canvas</Label>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
};
