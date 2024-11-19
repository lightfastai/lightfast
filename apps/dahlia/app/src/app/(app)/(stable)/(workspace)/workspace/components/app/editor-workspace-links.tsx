"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";

import { EditorWorkspaceNameInput } from "./editor-workspace-name-input";
import { EditorWorkspaceSelect } from "./editor-workspace-select";

export const EditorWorkspaceLinks = ({ id }: { id: string }) => {
  return (
    <div className="fixed inset-x-20 top-4 z-50 flex w-max items-center">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <EditorWorkspaceSelect />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <EditorWorkspaceNameInput id={id} />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
