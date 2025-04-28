"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";

import { useResources } from "~/hooks/use-resources";

export function RunsTable() {
  const { resources, loading } = useResources();

  return (
    <div className="bg-card rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Run ID</TableHead>
            <TableHead>Engine</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Queued at</TableHead>
            <TableHead>Resource</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-muted-foreground text-center"
              >
                Loading...
              </TableCell>
            </TableRow>
          ) : resources.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-muted-foreground text-center"
              >
                No runs found.
              </TableCell>
            </TableRow>
          ) : (
            resources.map((resource) => (
              <TableRow key={resource.id}>
                <TableCell>{resource.status}</TableCell>
                <TableCell className="font-mono text-xs">
                  {resource.id}
                </TableCell>
                <TableCell>{resource.engine}</TableCell>
                <TableCell>{resource.type}</TableCell>
                <TableCell>
                  {resource.external_request_id ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {resource.type === "image" && resource.url ? (
                    <img
                      src={resource.url}
                      alt="Resource"
                      className="h-12 rounded shadow"
                    />
                  ) : resource.type === "video" && resource.url ? (
                    <video
                      src={resource.url}
                      className="h-12 rounded shadow"
                      controls
                    />
                  ) : resource.type === "text" && resource.data ? (
                    <span className="whitespace-pre-wrap">
                      {String(resource.data)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
