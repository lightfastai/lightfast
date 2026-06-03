CREATE TABLE `lightfast_integration_calls` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`called_by_kind` varchar(32) NOT NULL,
	`called_by_id` varchar(128) NOT NULL,
	`called_by_user_id` varchar(64),
	`provider` varchar(32) NOT NULL,
	`routine_name` varchar(128) NOT NULL,
	`provider_tool_name` varchar(128) NOT NULL,
	`connector_connection_id` bigint unsigned NOT NULL,
	`provider_workspace_id` varchar(128),
	`provider_actor_id` varchar(128),
	`status` varchar(32) NOT NULL,
	`input_redacted` json,
	`output_redacted` json,
	`error_code` varchar(64),
	`error_message` text,
	`started_at` timestamp(3) NOT NULL,
	`finished_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_integration_calls_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_calls_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE INDEX `integration_calls_org_created_idx` ON `lightfast_integration_calls` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `integration_calls_org_caller_created_idx` ON `lightfast_integration_calls` (`clerk_org_id`,`called_by_kind`,`called_by_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `integration_calls_connection_created_idx` ON `lightfast_integration_calls` (`connector_connection_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `integration_calls_provider_routine_created_idx` ON `lightfast_integration_calls` (`provider`,`routine_name`,`created_at`,`id`);