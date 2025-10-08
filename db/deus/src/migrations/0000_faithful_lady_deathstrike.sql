CREATE TABLE `lightfast_deus_connected_repository` (
	`id` varchar(191) NOT NULL,
	`organization_id` varchar(191) NOT NULL,
	`github_repo_id` varchar(191) NOT NULL,
	`github_installation_id` varchar(191) NOT NULL,
	`permissions` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`connected_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`last_synced_at` datetime,
	`code_review_settings` json,
	`metadata` json,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `lightfast_deus_connected_repository_id` PRIMARY KEY(`id`),
	CONSTRAINT `lightfast_deus_connected_repository_github_repo_id_unique` UNIQUE(`github_repo_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_deus_organizations` (
	`id` varchar(191) NOT NULL,
	`github_org_id` int NOT NULL,
	`github_installation_id` int NOT NULL,
	`github_org_slug` varchar(255) NOT NULL,
	`github_org_name` varchar(255) NOT NULL,
	`github_org_avatar_url` text,
	`claimed_by` varchar(191) NOT NULL,
	`claimed_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_deus_organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `lightfast_deus_organizations_github_org_id_unique` UNIQUE(`github_org_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_deus_organization_members` (
	`id` varchar(191) NOT NULL,
	`organization_id` varchar(191) NOT NULL,
	`user_id` varchar(191) NOT NULL,
	`role` enum('owner','member') NOT NULL DEFAULT 'owner',
	`joined_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `lightfast_deus_organization_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_deus_code_reviews` (
	`id` varchar(191) NOT NULL,
	`repository_id` varchar(191) NOT NULL,
	`pull_request_number` int NOT NULL,
	`github_pr_id` varchar(191) NOT NULL,
	`review_tool` enum('coderabbit','claude','vercel-agents','custom') NOT NULL,
	`status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`triggered_by` varchar(191) NOT NULL,
	`triggered_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`started_at` datetime,
	`completed_at` datetime,
	`metadata` json,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_deus_code_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_deus_code_review_tasks` (
	`id` varchar(191) NOT NULL,
	`code_review_id` varchar(191) NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`severity` enum('info','warning','error','critical') NOT NULL DEFAULT 'info',
	`status` enum('open','resolved','dismissed') NOT NULL DEFAULT 'open',
	`metadata` json,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`resolved_at` datetime,
	`resolved_by` varchar(191),
	CONSTRAINT `lightfast_deus_code_review_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `org_id_idx` ON `lightfast_deus_connected_repository` (`organization_id`);--> statement-breakpoint
CREATE INDEX `org_active_idx` ON `lightfast_deus_connected_repository` (`organization_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `installation_idx` ON `lightfast_deus_connected_repository` (`github_installation_id`);--> statement-breakpoint
CREATE INDEX `org_slug_idx` ON `lightfast_deus_organizations` (`github_org_slug`);--> statement-breakpoint
CREATE INDEX `org_installation_idx` ON `lightfast_deus_organizations` (`github_installation_id`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `lightfast_deus_organization_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `organization_id_idx` ON `lightfast_deus_organization_members` (`organization_id`);--> statement-breakpoint
CREATE INDEX `user_org_idx` ON `lightfast_deus_organization_members` (`user_id`,`organization_id`);--> statement-breakpoint
CREATE INDEX `repository_id_idx` ON `lightfast_deus_code_reviews` (`repository_id`);--> statement-breakpoint
CREATE INDEX `pr_idx` ON `lightfast_deus_code_reviews` (`repository_id`,`pull_request_number`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `lightfast_deus_code_reviews` (`status`);--> statement-breakpoint
CREATE INDEX `triggered_by_idx` ON `lightfast_deus_code_reviews` (`triggered_by`);--> statement-breakpoint
CREATE INDEX `code_review_id_idx` ON `lightfast_deus_code_review_tasks` (`code_review_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `lightfast_deus_code_review_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `severity_idx` ON `lightfast_deus_code_review_tasks` (`severity`);--> statement-breakpoint
CREATE INDEX `review_status_idx` ON `lightfast_deus_code_review_tasks` (`code_review_id`,`status`);