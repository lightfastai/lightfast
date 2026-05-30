import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { userSourceControlAccounts } from "../schema";

describe("userSourceControlAccounts schema", () => {
  it("uses active-row uniqueness mirrors for Clerk and provider user ids", () => {
    const config = getTableConfig(userSourceControlAccounts);
    const columnsByName = new Map(
      config.columns.map((column) => [column.name, column])
    );
    const indexesByName = new Map(
      config.indexes.map((index) => [index.config.name, index])
    );
    const columnNames = config.columns.map((column) => column.name);
    const indexColumnNames = (indexName: string) =>
      indexesByName.get(indexName)?.config.columns.map((column) => {
        expect("name" in column).toBe(true);
        return "name" in column ? column.name : undefined;
      });

    expect(config.name).toBe("lightfast_user_source_control_accounts");
    expect(columnNames).toEqual(
      expect.arrayContaining([
        "clerk_user_id",
        "active_clerk_user_id",
        "active_provider_user_key",
        "provider",
        "provider_user_id",
        "encrypted_access_token",
        "encrypted_refresh_token",
        "access_token_expires_at",
        "refresh_token_expires_at",
      ])
    );
    expect(columnNames).not.toContain("provider_login");
    expect(columnNames).not.toContain("provider_avatar_url");
    expect(columnNames).not.toContain("provider_profile_url");
    expect(columnNames).not.toContain("provider_email");
    expect(columnNames).not.toContain("metadata");
    expect(columnNames).not.toContain("scope");

    expect(columnsByName.get("active_clerk_user_id")?.notNull).toBe(false);
    expect(columnsByName.get("active_provider_user_key")?.notNull).toBe(false);

    expect(
      indexesByName.get("user_source_control_accounts_active_user_uq")?.config
    ).toMatchObject({
      unique: true,
    });
    expect(
      indexColumnNames("user_source_control_accounts_active_user_uq")
    ).toEqual(["active_clerk_user_id"]);

    expect(
      indexesByName.get("user_source_control_accounts_active_provider_user_uq")
        ?.config
    ).toMatchObject({
      unique: true,
    });
    expect(
      indexColumnNames(
        "user_source_control_accounts_active_provider_user_uq"
      )
    ).toEqual(["active_provider_user_key"]);

    expect(
      indexesByName.get("user_source_control_accounts_user_status_idx")?.config
    ).toMatchObject({
      unique: false,
    });
    expect(
      indexColumnNames("user_source_control_accounts_user_status_idx")
    ).toEqual(["clerk_user_id", "status"]);

    expect(
      indexesByName.get("user_source_control_accounts_provider_user_idx")
        ?.config
    ).toMatchObject({
      unique: false,
    });
    expect(
      indexColumnNames("user_source_control_accounts_provider_user_idx")
    ).toEqual(["provider", "provider_user_id"]);
  });
});
