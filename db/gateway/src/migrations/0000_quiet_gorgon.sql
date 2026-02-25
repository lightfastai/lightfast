CREATE TABLE `gw_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`account_login` text,
	`connected_by` text NOT NULL,
	`org_id` text NOT NULL,
	`status` text NOT NULL,
	`webhook_secret` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gw_inst_provider_external_idx` ON `gw_installations` (`provider`,`external_id`);--> statement-breakpoint
CREATE INDEX `gw_inst_org_id_idx` ON `gw_installations` (`org_id`);--> statement-breakpoint
CREATE TABLE `gw_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`provider_resource_id` text NOT NULL,
	`resource_name` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`installation_id`) REFERENCES `gw_installations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gw_res_installation_id_idx` ON `gw_resources` (`installation_id`);--> statement-breakpoint
CREATE INDEX `gw_res_provider_resource_idx` ON `gw_resources` (`installation_id`,`provider_resource_id`);--> statement-breakpoint
CREATE TABLE `gw_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`installation_id`) REFERENCES `gw_installations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gw_webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`delivery_id` text NOT NULL,
	`event_type` text NOT NULL,
	`installation_id` text,
	`status` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `gw_wd_provider_delivery_idx` ON `gw_webhook_deliveries` (`provider`,`delivery_id`);