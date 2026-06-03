CREATE TABLE `lightfast_org_developer_connection_leases` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(96) NOT NULL,
	`connection_id` bigint unsigned NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`actor_user_id` varchar(64) NOT NULL,
	`sandbox_run_id` varchar(128) NOT NULL,
	`workflow_run_id` varchar(128) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`requested_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`issued_at` datetime(3) NOT NULL,
	`materialized_at` datetime(3),
	`expires_at` datetime(3) NOT NULL,
	`revoked_at` datetime(3),
	`failure_code` varchar(32),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_developer_connection_leases_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_developer_connection_leases_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_developer_connections` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(96) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`current_org_provider_key` varchar(97),
	`provider` varchar(32) NOT NULL,
	`provider_account_id` varchar(128),
	`provider_account_name` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`enabled_for_sandboxes` boolean NOT NULL DEFAULT true,
	`credential_kind` varchar(32) NOT NULL,
	`credential_schema_version` varchar(32) NOT NULL,
	`encrypted_credential` text,
	`scopes` json NOT NULL,
	`metadata` json NOT NULL,
	`expires_at` datetime(3),
	`last_verified_at` datetime(3),
	`last_used_at` datetime(3),
	`last_used_by_user_id` varchar(64),
	`created_by_user_id` varchar(64) NOT NULL,
	`updated_by_user_id` varchar(64) NOT NULL,
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_developer_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_developer_connections_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_developer_connections_current_org_provider_uq` UNIQUE(`current_org_provider_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_developer_sandbox_commands` (
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
	`started_at` datetime(3),
	`finished_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_developer_sandbox_commands_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_developer_sandbox_commands_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_developer_sandbox_runs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(96) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`actor_user_id` varchar(64) NOT NULL,
	`workflow_run_id` varchar(128),
	`vercel_sandbox_id` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`credentials_loaded_at` datetime(3),
	`expires_at` datetime(3) NOT NULL,
	`stopped_at` datetime(3),
	`cleanup_attempted_at` datetime(3),
	`cleanup_failure_code` varchar(32),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_developer_sandbox_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_developer_sandbox_runs_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE INDEX `org_developer_connection_leases_org_actor_idx` ON `lightfast_org_developer_connection_leases` (`clerk_org_id`,`actor_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `org_developer_connection_leases_workflow_idx` ON `lightfast_org_developer_connection_leases` (`workflow_run_id`,`provider`);--> statement-breakpoint
CREATE INDEX `org_developer_connections_org_provider_status_idx` ON `lightfast_org_developer_connections` (`clerk_org_id`,`provider`,`status`);--> statement-breakpoint
CREATE INDEX `org_developer_sandbox_commands_run_status_idx` ON `lightfast_org_developer_sandbox_commands` (`sandbox_run_id`,`status`);--> statement-breakpoint
CREATE INDEX `org_developer_sandbox_commands_org_actor_created_idx` ON `lightfast_org_developer_sandbox_commands` (`clerk_org_id`,`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `org_developer_sandbox_runs_org_actor_status_idx` ON `lightfast_org_developer_sandbox_runs` (`clerk_org_id`,`actor_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `org_developer_sandbox_runs_expires_status_idx` ON `lightfast_org_developer_sandbox_runs` (`expires_at`,`status`);