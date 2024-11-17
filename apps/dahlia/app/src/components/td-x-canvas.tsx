"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/ui/components/ui/resizable";

import { NetworkEditorContext } from "~/app/(app)/(stable)/(network-editor)/state/context";
import { NetworkCanvas } from "../app/(app)/(stable)/(network-editor)/components/network/network-canvas";
import { CENTER_OF_WORLD, WORLD_CAMERA_POSITION_FAR } from "./constants";
import { GeometryViewer } from "./r3f/geometry-viewer";
import { TDxGeometryPropertyInspector } from "./td-x-property-inspector-geometry";
import { TDxMaterialPropertyInspector } from "./td-x-property-inspector-material";
import { TDxTexturePropertyInspector } from "./td-x-property-inspector-texture";
import { isGeometry, isMaterial, isTexture } from "./types";

export default function TDxCanvas() {
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();

  return (
    <div className="flex h-screen flex-col">
      <div className="flex w-full items-center justify-end border-b">
        <div className="flex gap-4">
          <Button
            variant="ghost"
            onClick={() => machineRef.send({ type: "TOGGLE_COMMAND" })}
          >
            Press
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              machineRef.send({ type: "CLEAR" });
            }}
          >
            Clear Canvas
          </Button>
        </div>
      </div>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          defaultSize={70}
          className="flex flex-grow overflow-hidden"
        >
          <NetworkCanvas />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={30} className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={50}>
              <h2 className="p-4 font-mono text-sm font-bold uppercase tracking-widest">
                Scene
              </h2>
              <div className="h-full w-full">
                <GeometryViewer
                  geometries={state.context.geometries}
                  cameraPosition={WORLD_CAMERA_POSITION_FAR}
                  lookAt={CENTER_OF_WORLD}
                  shouldRenderGrid={true}
                  shouldRenderAxes={true}
                  shouldRender={true}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50}>
              {isGeometry(state.context.selectedProperty) && (
                <TDxGeometryPropertyInspector />
              )}
              {isMaterial(state.context.selectedProperty) && (
                <TDxMaterialPropertyInspector />
              )}
              {isTexture(state.context.selectedProperty) && (
                <TDxTexturePropertyInspector />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
