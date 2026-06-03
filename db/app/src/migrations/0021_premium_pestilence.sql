CREATE TABLE `lightfast_developer_sandbox_commands` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(96) NOT NULL,
	`sandbox_run_id` bigint unsigned NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`actor_user_id` varchar(64) NOT NULL,
	`cmd` varchar(256) NOT NULL,
	`args` json NOT NULL,
	`cwd` varchar(512),
	`status` varchar(32) NOT NULL,
	`policy_decision` varchar(32) NOT NULL,
	`policy_rule_id` varchar(128),
	`policy_reason` varchar(512),
	`exit_code` int,
	`stdout_bytes` int unsigned NOT NULL DEFAULT 0,
	`stderr_bytes` int unsigned NOT NULL DEFAULT 0,
	`redaction_count` int unsigned NOT NULL DEFAULT 0,
	`started_at` timestamp(3),
	`finished_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_developer_sandbox_commands_id` PRIMARY KEY(`id`),
	CONSTRAINT `developer_sandbox_commands_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_developer_sandbox_runs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(96) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`actor_user_id` varchar(64) NOT NULL,
	`workflow_run_id` varchar(128),
	`vercel_sandbox_id` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`credentials_loaded_at` timestamp(3),
	`expires_at` timestamp(3) NOT NULL,
	`stopped_at` timestamp(3),
	`cleanup_attempted_at` timestamp(3),
	`cleanup_failure_code` varchar(32),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_developer_sandbox_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `developer_sandbox_runs_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE INDEX `developer_sandbox_commands_run_status_idx` ON `lightfast_developer_sandbox_commands` (`sandbox_run_id`,`status`);--> statement-breakpoint
CREATE INDEX `developer_sandbox_commands_org_actor_created_idx` ON `lightfast_developer_sandbox_commands` (`clerk_org_id`,`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `developer_sandbox_runs_org_actor_status_idx` ON `lightfast_developer_sandbox_runs` (`clerk_org_id`,`actor_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `developer_sandbox_runs_expires_status_idx` ON `lightfast_developer_sandbox_runs` (`expires_at`,`status`);