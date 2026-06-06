CREATE TABLE `lightfast_user_connector_connections` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`clerk_user_id` varchar(64) NOT NULL,
	`current_user_provider_key` varchar(97),
	`provider` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`connected_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`revoked_at` datetime(3),
	`provider_account_id` varchar(128),
	`provider_account_name` varchar(128),
	`encrypted_access_token` text,
	`encrypted_refresh_token` text,
	`access_token_expires_at` datetime(3),
	`refresh_token_expires_at` datetime(3),
	`scopes` json NOT NULL,
	`mcp_endpoint` varchar(512) NOT NULL,
	`tool_manifest` json NOT NULL,
	`last_tool_refresh_at` datetime(3),
	`last_tool_refresh_error_at` datetime(3),
	`last_tool_refresh_error_code` varchar(32),
	`metadata` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_user_connector_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_connector_connections_current_user_provider_uq` UNIQUE(`current_user_provider_key`)
);
--> statement-breakpoint
CREATE INDEX `user_connector_connections_user_provider_status_idx` ON `lightfast_user_connector_connections` (`clerk_user_id`,`provider`,`status`);--> statement-breakpoint
CREATE INDEX `user_connector_connections_provider_account_idx` ON `lightfast_user_connector_connections` (`provider`,`provider_account_id`);