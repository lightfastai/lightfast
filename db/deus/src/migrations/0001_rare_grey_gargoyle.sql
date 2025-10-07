CREATE TABLE IF NOT EXISTS `lightfast_deus_organizations` (
	`id` varchar(191) NOT NULL,
	`github_installation_id` int NOT NULL,
	`github_org_id` int NOT NULL,
	`github_org_slug` varchar(255) NOT NULL,
	`github_org_name` varchar(255) NOT NULL,
	`github_org_avatar_url` text,
	`claimed_by` varchar(191) NOT NULL,
	`claimed_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_deus_organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `lightfast_deus_organizations_github_installation_id_unique` UNIQUE(`github_installation_id`),
	CONSTRAINT `lightfast_deus_organizations_github_org_id_unique` UNIQUE(`github_org_id`),
	CONSTRAINT `lightfast_deus_organizations_github_org_slug_unique` UNIQUE(`github_org_slug`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `lightfast_deus_organization_members` (
	`id` varchar(191) NOT NULL,
	`organization_id` varchar(191) NOT NULL,
	`user_id` varchar(191) NOT NULL,
	`role` enum('owner') NOT NULL DEFAULT 'owner',
	`joined_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `lightfast_deus_organization_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `lightfast_deus_organization_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `organization_id_idx` ON `lightfast_deus_organization_members` (`organization_id`);--> statement-breakpoint
CREATE INDEX `user_org_idx` ON `lightfast_deus_organization_members` (`user_id`,`organization_id`);