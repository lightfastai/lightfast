"use client";

import { useEffect, useState } from "react";
import { Circle, Monitor, Square, Triangle } from "lucide-react";

import type {
  GeometryType,
  MaterialType,
  TextureTypes,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import {
  $GeometryType,
  $MaterialType,
  $TextureTypes,
  $Txt2ImgType,
} from "@vendor/db/types";

import { useCommandDialog } from "../../hooks/use-command-dialog";
import { useWorkspaceShortcuts } from "../../hooks/use-workspace-shortcuts";
import { useSelectionStore } from "../../providers/selection-store-provider";

const TAB_VALUES = ["texture", "geometry", "material", "comp"] as const;

export const EditorCommandDialog = () => {
  const {
    setGeometry,
    setMaterial,
    setTexture,
    setFlux,
    setWindow,
    clearSelection,
  } = useSelectionStore((state) => state);
  useWorkspaceShortcuts();

  const { isOpen, open, close } = useCommandDialog();
  const [currentTabIndex, setCurrentTabIndex] = useState(0);

  // Focus search input when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the dialog is fully rendered
      const timer = setTimeout(() => {
        const searchInput = document.querySelector(
          'input[data-slot="command-input"]',
        );
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle tab navigation
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        setCurrentTabIndex((prev) => (prev + 1) % TAB_VALUES.length);
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        setCurrentTabIndex(
          (prev) => (prev - 1 + TAB_VALUES.length) % TAB_VALUES.length,
        );
      }
      // Handle search focus
      else if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.querySelector(
          'input[data-slot="command-input"]',
        );
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  /**
   * Handle geometry selection
   */
  const handleGeometrySelect = (geometryType: GeometryType) => {
    // Close the command dialog first
    close();

    // Notify parent component of the selected geometry
    setGeometry(geometryType);
  };

  const handleMaterialSelect = (materialType: MaterialType) => {
    // Close the command dialog first
    close();

    // Notify parent component of the selected material
    setMaterial(materialType);
  };

  const handleTextureSelect = (textureType: TextureTypes) => {
    // Close the command dialog first
    close();

    // Notify parent component of the selected texture
    setTexture(textureType);
  };

  const handleFluxSelect = (fluxType: Txt2ImgType) => {
    // Close the command dialog first
    close();

    // Notify parent component of the selected flux
    setFlux(fluxType);
  };

  const handleWindowSelect = () => {
    // Close the command dialog first
    close();

    // Notify parent component of the selected window type
    setWindow();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={close}>
      <Command>
        <Tabs value={TAB_VALUES[currentTabIndex]} className="gap-0">
          <TabsList className="h-8 w-full rounded-none border-b bg-background">
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
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <TabsContent value="texture" className="p-0">
              <CommandGroup heading="Texture Operations">
                <div className="grid grid-cols-4 grid-rows-10 gap-1">
                  <CommandItem
                    onSelect={() =>
                      handleTextureSelect($TextureTypes.Enum.Noise)
                    }
                    className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                  >
                    Noise
                  </CommandItem>
                  <CommandItem
                    onSelect={() =>
                      handleTextureSelect($TextureTypes.Enum.Limit)
                    }
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
                </div>
              </CommandGroup>
            </TabsContent>

            <TabsContent value="geometry" className="px-1">
              <CommandGroup heading="Basic Shapes">
                <div className="grid grid-cols-4 grid-rows-10 gap-1">
                  <CommandItem
                    onSelect={() =>
                      handleGeometrySelect($GeometryType.Enum.box)
                    }
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
                </div>
              </CommandGroup>
            </TabsContent>

            <TabsContent value="material" className="px-1">
              <CommandGroup heading="Materials">
                <div className="grid grid-cols-4 grid-rows-10 gap-1">
                  <CommandItem
                    onSelect={() =>
                      handleMaterialSelect($MaterialType.Enum.phong)
                    }
                    className="col-span-1 row-span-1 flex h-7 w-full cursor-pointer items-center rounded-md border px-0.5 text-xs"
                  >
                    Phong
                  </CommandItem>
                </div>
              </CommandGroup>
            </TabsContent>

            <TabsContent value="comp" className="px-1">
              <CommandGroup heading="Components">
                <div className="grid grid-cols-4 grid-rows-10 gap-1">
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
                </div>
              </CommandGroup>
            </TabsContent>
          </CommandList>
        </Tabs>
      </Command>
    </CommandDialog>
  );
};
