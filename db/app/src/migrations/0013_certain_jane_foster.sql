CREATE TABLE `lightfast_identity_index_files` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`identity_index_state_id` bigint unsigned NOT NULL,
	`indexed_commit_sha` varchar(64),
	`kind` varchar(64) NOT NULL,
	`path` varchar(512) NOT NULL,
	`status` varchar(64) NOT NULL,
	`source_markdown` mediumtext,
	`content_hash` varchar(128),
	`content_sha` varchar(64),
	`content_size` int unsigned,
	`diagnostics` json NOT NULL DEFAULT (JSON_ARRAY()),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_identity_index_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `identity_index_files_state_kind_uq` UNIQUE(`identity_index_state_id`,`kind`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_identity_index_states` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`source_control_repository_id` bigint unsigned NOT NULL,
	`indexed_commit_sha` varchar(64),
	`indexed_tree_sha` varchar(64),
	`indexed_at` timestamp(3),
	`present_file_count` int unsigned NOT NULL DEFAULT 0,
	`missing_file_count` int unsigned NOT NULL DEFAULT 0,
	`too_large_file_count` int unsigned NOT NULL DEFAULT 0,
	`read_error_file_count` int unsigned NOT NULL DEFAULT 0,
	`last_checked_commit_sha` varchar(64),
	`last_checked_at` timestamp(3),
	`github_ref_etag` varchar(256),
	`last_refresh_status` varchar(64) NOT NULL DEFAULT 'never',
	`last_refresh_error_code` varchar(64),
	`last_refresh_error_message` varchar(512),
	`last_refresh_succeeded_at` timestamp(3),
	`last_refresh_failed_at` timestamp(3),
	`index_diagnostics` json NOT NULL DEFAULT (JSON_ARRAY()),
	`refresh_lock_token` varchar(128),
	`refresh_locked_until` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_identity_index_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `identity_index_states_source_control_repository_uq` UNIQUE(`source_control_repository_id`)
);
--> statement-breakpoint
ALTER TABLE `lightfast_signals` ADD `classification_metadata` json;--> statement-breakpoint
CREATE INDEX `identity_index_files_state_status_idx` ON `lightfast_identity_index_files` (`identity_index_state_id`,`status`);--> statement-breakpoint
CREATE INDEX `identity_index_states_last_checked_idx` ON `lightfast_identity_index_states` (`last_checked_at`);--> statement-breakpoint
CREATE INDEX `identity_index_states_refresh_locked_until_idx` ON `lightfast_identity_index_states` (`refresh_locked_until`);