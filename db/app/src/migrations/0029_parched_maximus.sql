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
CREATE TABLE `lightfast_user_connector_tool_calls` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`called_by_user_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64),
	`provider` varchar(32) NOT NULL,
	`routine_id` varchar(128) NOT NULL,
	`provider_tool_name` varchar(128) NOT NULL,
	`provider_connection_id` bigint unsigned NOT NULL,
	`provider_attempted` boolean NOT NULL DEFAULT false,
	`source_surface` varchar(32) NOT NULL DEFAULT 'interactive_chat',
	`source_ref` varchar(128),
	`status` varchar(32) NOT NULL,
	`input_redacted` json,
	`output_redacted` json,
	`error_code` varchar(64),
	`error_message` text,
	`started_at` datetime(3) NOT NULL,
	`finished_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_user_connector_tool_calls_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_connector_tool_calls_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE INDEX `user_connector_connections_user_provider_status_idx` ON `lightfast_user_connector_connections` (`clerk_user_id`,`provider`,`status`);--> statement-breakpoint
CREATE INDEX `user_connector_connections_provider_account_idx` ON `lightfast_user_connector_connections` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `user_connector_tool_calls_user_created_idx` ON `lightfast_user_connector_tool_calls` (`called_by_user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `user_connector_tool_calls_org_created_idx` ON `lightfast_user_connector_tool_calls` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `user_connector_tool_calls_connection_created_idx` ON `lightfast_user_connector_tool_calls` (`provider_connection_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `user_connector_tool_calls_provider_routine_created_idx` ON `lightfast_user_connector_tool_calls` (`provider`,`routine_id`,`created_at`,`id`);