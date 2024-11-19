"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";

import { useGetWorkspace } from "../../hooks/use-get-workspace";

export const WorkspaceBreadcrumbLinks = ({ id }: { id: string }) => {
  const workspace = useGetWorkspace({ id });
  return (
    <div className="fixed inset-x-0 top-0 z-[1] flex items-center justify-between px-20 py-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink>Workspace</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>{workspace?.name}</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
