CREATE TABLE `lightfast_source_control_repositories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_source_control_binding_id` bigint unsigned NOT NULL,
	`provider_repository_id` varchar(128) NOT NULL,
	`full_name` varchar(256) NOT NULL,
	`watched_path_globs` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_source_control_repositories_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_control_repositories_binding_repository_uq` UNIQUE(`org_source_control_binding_id`,`provider_repository_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_source_control_webhook_deliveries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`delivery_id` varchar(128) NOT NULL,
	`event` varchar(64) NOT NULL,
	`provider_installation_id` varchar(128) NOT NULL,
	`provider_repository_id` varchar(128) NOT NULL,
	`status` varchar(64) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_source_control_webhook_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_control_webhook_deliveries_delivery_id_uq` UNIQUE(`delivery_id`)
);
--> statement-breakpoint
CREATE INDEX `source_control_repositories_provider_repository_idx` ON `lightfast_source_control_repositories` (`provider_repository_id`);--> statement-breakpoint
CREATE INDEX `source_control_webhook_deliveries_installation_repository_idx` ON `lightfast_source_control_webhook_deliveries` (`provider_installation_id`,`provider_repository_id`);--> statement-breakpoint
CREATE INDEX `source_control_webhook_deliveries_status_updated_idx` ON `lightfast_source_control_webhook_deliveries` (`status`,`updated_at`);