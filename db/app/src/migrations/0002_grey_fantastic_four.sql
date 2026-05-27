CREATE TABLE `lightfast_signals` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`created_by_api_key_id` varchar(128) NOT NULL,
	`input` text NOT NULL,
	`status` varchar(32) NOT NULL,
	`classification` json,
	`error_code` varchar(64),
	`error_message` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_signals_id` PRIMARY KEY(`id`),
	CONSTRAINT `signals_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE INDEX `signals_org_created_idx` ON `lightfast_signals` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `signals_org_status_created_idx` ON `lightfast_signals` (`clerk_org_id`,`status`,`created_at`,`id`);