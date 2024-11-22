"use client";

import { useEffect } from "react";
import { Circle, Square, Triangle } from "lucide-react";

import {
  $GeometryType,
  $MaterialType,
  GeometryType,
  MaterialType,
} from "@repo/db/schema";
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

import { useEditorStore } from "../../providers/editor-store-provider";
import { useSelectionStore } from "../../providers/selection-store-provider";

export const EditorCommandDialog = () => {
  const { setGeometry, setMaterial, clearSelection } = useSelectionStore(
    (state) => state,
  );

  const { isCommandDialogOpen, setIsCommandDialogOpen } = useEditorStore(
    (state) => state,
  );

  /**
   * Handle geometry selection
   */
  const handleGeometrySelect = (geometryType: GeometryType) => {
    // Close the command dialog first
    setIsCommandDialogOpen(false);

    // Notify parent component of the selected geometry
    setGeometry(geometryType);
  };

  const handleMaterialSelect = (materialType: MaterialType) => {
    // Close the command dialog first
    setIsCommandDialogOpen(false);

    // Notify parent component of the selected material
    setMaterial(materialType);
  };

  /**
   * Handle global command dialog toggle
   * @usage (CMD + K)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandDialogOpen(true);
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
        setIsCommandDialogOpen(true);
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
        setIsCommandDialogOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <CommandDialog
      open={isCommandDialogOpen}
      onOpenChange={() => setIsCommandDialogOpen(false)}
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
              onSelect={() => handleMaterialSelect($MaterialType.Enum.phong)}
            >
              <Label>Phong</Label>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="TOP">
            <CommandItem
              onSelect={() => {
                // setTexture($TextureTypes.Enum.Noise);
              }}
              className="flex items-center gap-2"
            >
              <Label>Noise</Label>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                // setTexture($TextureTypes.Enum.Limit);
              }}
              className="flex items-center gap-2"
            >
              <Label>Limit</Label>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Utilities">
            <CommandItem
              onSelect={() => {
                // clearSelection();
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
