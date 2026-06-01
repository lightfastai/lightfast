CREATE TABLE `lightfast_skill_index_entries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`skill_index_state_id` bigint unsigned NOT NULL,
	`indexed_commit_sha` varchar(64) NOT NULL,
	`slug` varchar(63) NOT NULL,
	`path` varchar(512) NOT NULL,
	`name` varchar(63),
	`description` varchar(1024),
	`license` varchar(256),
	`compatibility` varchar(512),
	`allowed_tools` varchar(2048),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`source_markdown` text,
	`body_markdown` text,
	`content_sha` varchar(64) NOT NULL,
	`content_size` int unsigned,
	`validation_status` varchar(64) NOT NULL,
	`diagnostics` json NOT NULL DEFAULT (JSON_ARRAY()),
	`resources` json NOT NULL,
	`resources_truncated` int unsigned NOT NULL DEFAULT 0,
	`non_standard_resource_count` int unsigned NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_skill_index_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `skill_index_entries_state_slug_uq` UNIQUE(`skill_index_state_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_skill_index_states` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`source_control_repository_id` bigint unsigned NOT NULL,
	`indexed_commit_sha` varchar(64),
	`indexed_tree_sha` varchar(64),
	`indexed_at` timestamp(3),
	`skill_count` int unsigned NOT NULL DEFAULT 0,
	`invalid_skill_count` int unsigned NOT NULL DEFAULT 0,
	`last_checked_commit_sha` varchar(64),
	`last_checked_at` timestamp(3),
	`github_ref_etag` varchar(256),
	`last_refresh_status` varchar(64) NOT NULL DEFAULT 'never',
	`last_refresh_error_code` varchar(64),
	`last_refresh_error_message` varchar(512),
	`last_refresh_failed_at` timestamp(3),
	`index_diagnostics` json NOT NULL DEFAULT (JSON_ARRAY()),
	`refresh_lock_token` varchar(128),
	`refresh_locked_until` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_skill_index_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `skill_index_states_source_control_repository_uq` UNIQUE(`source_control_repository_id`)
);
--> statement-breakpoint
CREATE INDEX `skill_index_entries_state_validation_idx` ON `lightfast_skill_index_entries` (`skill_index_state_id`,`validation_status`);--> statement-breakpoint
CREATE INDEX `skill_index_states_last_checked_idx` ON `lightfast_skill_index_states` (`last_checked_at`);--> statement-breakpoint
CREATE INDEX `skill_index_states_refresh_locked_until_idx` ON `lightfast_skill_index_states` (`refresh_locked_until`);
