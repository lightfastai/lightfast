CREATE TABLE `lightfast_automation_runs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`automation_id` bigint unsigned NOT NULL,
	`automation_public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`trigger` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`due_at` datetime(3) NOT NULL,
	`started_at` datetime(3),
	`finished_at` datetime(3),
	`schedule_version` int unsigned NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`output` json,
	`error_code` varchar(64),
	`error_message` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_automation_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `automation_runs_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `automation_runs_idempotency_key_uq` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_automations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`prompt` text NOT NULL,
	`schedule_kind` varchar(32) NOT NULL,
	`schedule_config` json NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`status` varchar(32) NOT NULL,
	`next_run_at` datetime(3) NOT NULL,
	`last_run_at` datetime(3),
	`schedule_version` int unsigned NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_automations_id` PRIMARY KEY(`id`),
	CONSTRAINT `automations_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE INDEX `automation_runs_automation_created_idx` ON `lightfast_automation_runs` (`automation_public_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `automation_runs_org_status_created_idx` ON `lightfast_automation_runs` (`clerk_org_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `automations_org_status_next_run_idx` ON `lightfast_automations` (`clerk_org_id`,`status`,`next_run_at`,`id`);--> statement-breakpoint
CREATE INDEX `automations_due_idx` ON `lightfast_automations` (`status`,`next_run_at`,`id`);