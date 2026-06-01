import { getTableConfig } from "drizzle-orm/mysql-core";
import { describe, expect, it } from "vitest";

import { namespaceOperations, namespaces } from "../schema";

function indexColumnNames(index: { config: { columns: unknown[] } }) {
  return index.config.columns.map((column) => {
    expect(column && typeof column === "object" && "name" in column).toBe(true);
    return column && typeof column === "object" && "name" in column
      ? (column.name as string)
      : undefined;
  });
}

describe("namespaces schema", () => {
  it("defines namespace rows with a globally unique handle", () => {
    const config = getTableConfig(namespaces);
    const indexes = new Map(
      config.indexes.map((index) => [index.config.name, index])
    );
    const columnNames = config.columns.map((column) => column.name);

    expect(config.name).toBe("lightfast_namespaces");
    expect(columnNames).toEqual(
      expect.arrayContaining([
        "id",
        "handle",
        "kind",
        "clerk_user_id",
        "clerk_org_id",
        "claimed_clerk_user_id",
        "claimed_clerk_org_id",
        "status",
        "active_operation_id",
        "created_at",
        "updated_at",
      ])
    );

    expect(indexes.get("namespaces_handle_uq")?.config).toMatchObject({
      unique: true,
    });
    expect(indexColumnNames(indexes.get("namespaces_handle_uq")!)).toEqual([
      "handle",
    ]);
    expect(indexes.get("namespaces_active_operation_uq")?.config).toMatchObject(
      {
        unique: true,
      }
    );
    expect(
      indexColumnNames(indexes.get("namespaces_active_operation_uq")!)
    ).toEqual(["active_operation_id"]);
    expect(indexes.get("namespaces_claimed_user_uq")?.config).toMatchObject({
      unique: true,
    });
    expect(
      indexColumnNames(indexes.get("namespaces_claimed_user_uq")!)
    ).toEqual(["claimed_clerk_user_id"]);
    expect(indexes.get("namespaces_claimed_org_uq")?.config).toMatchObject({
      unique: true,
    });
    expect(indexColumnNames(indexes.get("namespaces_claimed_org_uq")!)).toEqual(
      ["claimed_clerk_org_id"]
    );
    expect(indexColumnNames(indexes.get("namespaces_user_idx")!)).toEqual([
      "clerk_user_id",
      "status",
    ]);
    expect(indexColumnNames(indexes.get("namespaces_org_idx")!)).toEqual([
      "clerk_org_id",
      "status",
    ]);
  });

  it("defines durable namespace operation rows", () => {
    const config = getTableConfig(namespaceOperations);
    const indexes = new Map(
      config.indexes.map((index) => [index.config.name, index])
    );
    const columnNames = config.columns.map((column) => column.name);

    expect(config.name).toBe("lightfast_namespace_operations");
    expect(columnNames).toEqual(
      expect.arrayContaining([
        "id",
        "operation_type",
        "owner_kind",
        "clerk_user_id",
        "clerk_org_id",
        "idempotency_clerk_user_id",
        "idempotency_clerk_org_id",
        "from_handle",
        "to_handle",
        "status",
        "idempotency_key",
        "error_code",
        "error_message",
        "created_at",
        "updated_at",
        "expires_at",
      ])
    );

    expect(
      indexes.get("namespace_operations_user_idempotency_uq")?.config
    ).toMatchObject({ unique: true });
    expect(
      indexColumnNames(indexes.get("namespace_operations_user_idempotency_uq")!)
    ).toEqual([
      "idempotency_clerk_user_id",
      "operation_type",
      "idempotency_key",
    ]);
    expect(
      indexes.get("namespace_operations_org_idempotency_uq")?.config
    ).toMatchObject({ unique: true });
    expect(
      indexColumnNames(indexes.get("namespace_operations_org_idempotency_uq")!)
    ).toEqual([
      "idempotency_clerk_org_id",
      "operation_type",
      "idempotency_key",
    ]);
    expect(
      indexColumnNames(indexes.get("namespace_operations_status_idx")!)
    ).toEqual(["status", "updated_at"]);
    expect(
      indexColumnNames(indexes.get("namespace_operations_user_idx")!)
    ).toEqual(["clerk_user_id", "status"]);
    expect(
      indexColumnNames(indexes.get("namespace_operations_org_idx")!)
    ).toEqual(["clerk_org_id", "status"]);
  });
});
