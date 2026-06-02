CREATE TABLE `lightfast_workspace_assistant_context_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`message_id` bigint unsigned,
	`clerk_org_id` varchar(64) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`source_public_id` varchar(128),
	`source_slug` varchar(128),
	`title` varchar(160),
	`snapshot` json NOT NULL,
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_workspace_assistant_context_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_assistant_context_items_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_workspace_assistant_conversations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`title` varchar(160),
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`active_stream_id` varchar(80),
	`last_message_id` bigint unsigned,
	`last_message_at` timestamp(3),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_workspace_assistant_conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_assistant_conversations_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_workspace_assistant_generations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`assistant_message_id` bigint unsigned NOT NULL,
	`assistant_message_public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`requested_by_user_id` varchar(64) NOT NULL,
	`model` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`finish_reason` varchar(32),
	`usage` json,
	`provider_metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`request_metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`error_code` varchar(64),
	`error_message` text,
	`started_at` timestamp(3),
	`finished_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_workspace_assistant_generations_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_assistant_generations_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `workspace_assistant_generations_assistant_message_uq` UNIQUE(`assistant_message_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_workspace_assistant_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`conversation_public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`role` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'completed',
	`sequence` int unsigned NOT NULL,
	`idempotency_key` varchar(128),
	`parts` json NOT NULL DEFAULT (JSON_ARRAY()),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`error_code` varchar(64),
	`error_message` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_workspace_assistant_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_assistant_messages_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `workspace_assistant_messages_conversation_sequence_uq` UNIQUE(`conversation_id`,`sequence`),
	CONSTRAINT `workspace_assistant_messages_conversation_idempotency_key_uq` UNIQUE(`conversation_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_workspace_assistant_tool_calls` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`generation_id` bigint unsigned NOT NULL,
	`generation_public_id` varchar(80) NOT NULL,
	`message_id` bigint unsigned NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`tool_call_id` varchar(128) NOT NULL,
	`tool_name` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`input` json DEFAULT (JSON_OBJECT()),
	`output` json,
	`error_code` varchar(64),
	`error_message` text,
	`started_at` timestamp(3),
	`finished_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_workspace_assistant_tool_calls_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_assistant_tool_calls_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `workspace_assistant_tool_calls_generation_tool_call_uq` UNIQUE(`generation_id`,`tool_call_id`)
);
--> statement-breakpoint
CREATE INDEX `workspace_assistant_context_items_conversation_kind_idx` ON `lightfast_workspace_assistant_context_items` (`conversation_id`,`kind`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_context_items_message_kind_idx` ON `lightfast_workspace_assistant_context_items` (`message_id`,`kind`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_context_items_org_created_idx` ON `lightfast_workspace_assistant_context_items` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_conversations_org_user_status_updated_idx` ON `lightfast_workspace_assistant_conversations` (`clerk_org_id`,`created_by_user_id`,`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_conversations_org_created_idx` ON `lightfast_workspace_assistant_conversations` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_generations_org_status_idx` ON `lightfast_workspace_assistant_generations` (`clerk_org_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_generations_org_user_status_idx` ON `lightfast_workspace_assistant_generations` (`clerk_org_id`,`requested_by_user_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_generations_conversation_created_idx` ON `lightfast_workspace_assistant_generations` (`conversation_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_messages_conversation_created_idx` ON `lightfast_workspace_assistant_messages` (`conversation_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_messages_org_user_conversation_sequence_idx` ON `lightfast_workspace_assistant_messages` (`clerk_org_id`,`created_by_user_id`,`conversation_id`,`sequence`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_messages_org_created_idx` ON `lightfast_workspace_assistant_messages` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_tool_calls_message_idx` ON `lightfast_workspace_assistant_tool_calls` (`message_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `workspace_assistant_tool_calls_org_created_idx` ON `lightfast_workspace_assistant_tool_calls` (`clerk_org_id`,`created_at`,`id`);