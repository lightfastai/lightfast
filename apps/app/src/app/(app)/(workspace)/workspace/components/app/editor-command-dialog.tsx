"use client";

import { useEffect } from "react";
import { Circle, Monitor, Square, Triangle } from "lucide-react";

import type {
  GeometryType,
  MaterialType,
  TextureType,
  Txt2ImgType,
} from "@vendor/db/types";
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
import {
  $GeometryType,
  $MaterialType,
  $TextureTypes,
  $Txt2ImgType,
} from "@vendor/db/types";

import { useEditorStore } from "../../providers/editor-store-provider";
import { useSelectionStore } from "../../providers/selection-store-provider";

export const EditorCommandDialog = () => {
  const {
    setGeometry,
    setMaterial,
    setTexture,
    setFlux,
    setWindow,
    clearSelection,
  } = useSelectionStore((state) => state);

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

  const handleTextureSelect = (textureType: TextureType) => {
    // Close the command dialog first
    setIsCommandDialogOpen(false);

    // Notify parent component of the selected texture
    setTexture(textureType);
  };

  const handleFluxSelect = (fluxType: Txt2ImgType) => {
    // Close the command dialog first
    setIsCommandDialogOpen(false);

    // Notify parent component of the selected flux
    setFlux(fluxType);
  };

  const handleWindowSelect = () => {
    // Close the command dialog first
    setIsCommandDialogOpen(false);

    // Notify parent component of the selected window type
    setWindow();
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
          <CommandGroup heading="TOP">
            <CommandItem
              onSelect={() => handleTextureSelect($TextureTypes.Enum.Noise)}
              className="flex items-center gap-2"
            >
              <Label>Noise</Label>
            </CommandItem>
            <CommandItem
              onSelect={() => handleTextureSelect($TextureTypes.Enum.Limit)}
              className="flex items-center gap-2"
            >
              <Label>Limit</Label>
            </CommandItem>
            <CommandItem
              onSelect={() => handleTextureSelect($TextureTypes.Enum.Displace)}
              className="flex items-center gap-2"
            >
              <Label>Displace</Label>
            </CommandItem>
            <CommandItem
              onSelect={() => handleTextureSelect($TextureTypes.Enum.Add)}
              className="flex items-center gap-2"
            >
              <Label>Add</Label>
            </CommandItem>
          </CommandGroup>
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
            <CommandItem
              onSelect={() => handleGeometrySelect($GeometryType.Enum.plane)}
              className="flex items-center gap-2"
            >
              <Label>Plane</Label>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Material">
            <CommandItem
              onSelect={() => handleMaterialSelect($MaterialType.Enum.phong)}
            >
              <Label>Phong</Label>
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="AI">
            <CommandItem
              onSelect={() => handleFluxSelect($Txt2ImgType.Enum["flux/dev"])}
              className="flex items-center gap-2"
            >
              <Label>Flux</Label>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Window">
            <CommandItem
              onSelect={handleWindowSelect}
              className="flex items-center gap-2"
            >
              <Monitor className="h-4 w-4" />
              <Label>External Window</Label>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
};
