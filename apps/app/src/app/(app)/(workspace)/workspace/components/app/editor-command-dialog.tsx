"use client";

import { useEffect } from "react";
import { Circle, Monitor, Square, Triangle } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";

import type {
  GeometryType,
  MaterialType,
  TextureType,
  Txt2ImgType,
} from "~/db/schema/types";
import {
  $GeometryType,
  $MaterialType,
  $TextureTypes,
  $Txt2ImgType,
} from "~/db/schema/types";
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
          <div className="flex w-full flex-col">
            <Tabs defaultValue="texture" className="gap-2">
              <TabsList className="h-8 w-full border-b bg-background">
                <TabsTrigger value="texture" className="text-xs">
                  TOP
                </TabsTrigger>
                <TabsTrigger value="geometry" className="text-xs">
                  GEO
                </TabsTrigger>
                <TabsTrigger value="material" className="text-xs">
                  MAT
                </TabsTrigger>
                <TabsTrigger value="comp" className="text-xs">
                  COMP
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="texture"
                className="grid grid-cols-4 grid-rows-10 gap-1 px-1"
              >
                <CommandItem
                  onSelect={() => handleTextureSelect($TextureTypes.Enum.Noise)}
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  Noise
                </CommandItem>
                <CommandItem
                  onSelect={() => handleTextureSelect($TextureTypes.Enum.Limit)}
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  Limit
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    handleTextureSelect($TextureTypes.Enum.Displace)
                  }
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  Displace
                </CommandItem>
                <CommandItem
                  onSelect={() => handleTextureSelect($TextureTypes.Enum.Add)}
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  Add
                </CommandItem>
              </TabsContent>

              <TabsContent
                value="geometry"
                className="grid grid-cols-4 grid-rows-10 gap-1 px-1"
              >
                <CommandItem
                  onSelect={() => handleGeometrySelect($GeometryType.Enum.box)}
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  <Square className="mr-1 h-3 w-3" />
                  Box
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    handleGeometrySelect($GeometryType.Enum.sphere)
                  }
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  <Circle className="mr-1 h-3 w-3" />
                  Sphere
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    handleGeometrySelect($GeometryType.Enum.tetrahedron)
                  }
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  <Triangle className="mr-1 h-3 w-3" />
                  Tetrahedron
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    handleGeometrySelect($GeometryType.Enum.torus)
                  }
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  <Circle className="mr-1 h-3 w-3" />
                  Torus
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    handleGeometrySelect($GeometryType.Enum.plane)
                  }
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  Plane
                </CommandItem>
              </TabsContent>

              <TabsContent
                value="material"
                className="grid grid-cols-4 grid-rows-10 gap-1 px-1"
              >
                <CommandItem
                  onSelect={() =>
                    handleMaterialSelect($MaterialType.Enum.phong)
                  }
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  Phong
                </CommandItem>
              </TabsContent>

              <TabsContent
                value="comp"
                className="grid grid-cols-4 grid-rows-10 gap-1 px-1"
              >
                <CommandItem
                  onSelect={handleWindowSelect}
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  <Monitor className="mr-1 h-1 w-1" />
                  Window
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    handleFluxSelect($Txt2ImgType.Enum["flux/dev"])
                  }
                  className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                >
                  Flux
                </CommandItem>
              </TabsContent>
            </Tabs>
          </div>
        </CommandList>
      </Command>
    </CommandDialog>
  );
};
