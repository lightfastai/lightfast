CREATE TABLE `lightfast_org_connector_connections` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`current_org_provider_key` varchar(97),
	`provider` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`connected_by_user_id` varchar(64) NOT NULL,
	`connected_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`revoked_at` timestamp(3),
	`provider_workspace_id` varchar(128),
	`provider_workspace_name` varchar(128),
	`provider_actor_id` varchar(128),
	`provider_actor_name` varchar(128),
	`encrypted_access_token` text,
	`encrypted_refresh_token` text,
	`access_token_expires_at` timestamp(3),
	`refresh_token_expires_at` timestamp(3),
	`scopes` json NOT NULL,
	`mcp_endpoint` varchar(512) NOT NULL,
	`tool_manifest` json NOT NULL,
	`last_tool_refresh_at` timestamp(3),
	`last_tool_refresh_error_at` timestamp(3),
	`last_tool_refresh_error_code` varchar(32),
	`enabled_for_automations` boolean NOT NULL DEFAULT false,
	`metadata` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_connector_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_connector_connections_current_org_provider_uq` UNIQUE(`current_org_provider_key`)
);
--> statement-breakpoint
ALTER TABLE `lightfast_automations` MODIFY COLUMN `next_run_at` datetime(3);--> statement-breakpoint
CREATE INDEX `org_connector_connections_org_provider_status_idx` ON `lightfast_org_connector_connections` (`clerk_org_id`,`provider`,`status`);--> statement-breakpoint
CREATE INDEX `org_connector_connections_provider_workspace_idx` ON `lightfast_org_connector_connections` (`provider`,`provider_workspace_id`);