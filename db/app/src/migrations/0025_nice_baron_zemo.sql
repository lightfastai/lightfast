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
CREATE INDEX `user_connector_tool_calls_user_created_idx` ON `lightfast_user_connector_tool_calls` (`called_by_user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `user_connector_tool_calls_org_created_idx` ON `lightfast_user_connector_tool_calls` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `user_connector_tool_calls_connection_created_idx` ON `lightfast_user_connector_tool_calls` (`provider_connection_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `user_connector_tool_calls_provider_routine_created_idx` ON `lightfast_user_connector_tool_calls` (`provider`,`routine_id`,`created_at`,`id`);