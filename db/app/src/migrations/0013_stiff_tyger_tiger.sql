CREATE TABLE `lightfast_mcp_audit_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`event_name` varchar(128) NOT NULL,
	`outcome` varchar(32) NOT NULL,
	`clerk_org_id` varchar(64),
	`clerk_user_id` varchar(64),
	`client_public_id` varchar(128),
	`grant_public_id` varchar(128),
	`metadata` json,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_mcp_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_mcp_oauth_authorization_codes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`code_hash` varchar(128) NOT NULL,
	`client_public_id` varchar(128) NOT NULL,
	`clerk_user_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`redirect_uri` varchar(2048) NOT NULL,
	`resource` varchar(512) NOT NULL,
	`resource_hash` varchar(64) NOT NULL,
	`scopes` json NOT NULL,
	`code_challenge` varchar(256) NOT NULL,
	`code_challenge_method` varchar(32) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`consumed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_mcp_oauth_authorization_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `mcp_authorization_codes_hash_uq` UNIQUE(`code_hash`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_mcp_oauth_client_redirect_uris` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`client_public_id` varchar(128) NOT NULL,
	`redirect_uri` varchar(2048) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_mcp_oauth_client_redirect_uris_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_mcp_oauth_clients` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_client_id` varchar(128) NOT NULL,
	`client_name` varchar(255) NOT NULL,
	`client_uri` varchar(2048),
	`logo_uri` varchar(2048),
	`contacts` json,
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`metadata` json,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_mcp_oauth_clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `mcp_oauth_clients_public_id_uq` UNIQUE(`public_client_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_mcp_oauth_grants` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(128) NOT NULL,
	`client_public_id` varchar(128) NOT NULL,
	`clerk_user_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`resource` varchar(512) NOT NULL,
	`resource_hash` varchar(64) NOT NULL,
	`scopes` json NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`metadata` json,
	`last_used_at` timestamp(3),
	`revoked_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_mcp_oauth_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `mcp_grants_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_mcp_oauth_refresh_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`grant_public_id` varchar(128) NOT NULL,
	`client_public_id` varchar(128) NOT NULL,
	`clerk_user_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`parent_token_hash` varchar(128),
	`rotated_to_token_hash` varchar(128),
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`expires_at` timestamp(3) NOT NULL,
	`reuse_detected_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_mcp_oauth_refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `mcp_refresh_token_hash_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_mcp_oauth_registration_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(128) NOT NULL,
	`client_public_id` varchar(128) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`expires_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_mcp_oauth_registration_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `mcp_registration_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `mcp_registration_token_hash_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `lightfast_signals` ADD `created_by_mcp_client_id` varchar(128);--> statement-breakpoint
ALTER TABLE `lightfast_signals` ADD `created_by_mcp_grant_id` varchar(128);--> statement-breakpoint
CREATE INDEX `mcp_audit_org_created_idx` ON `lightfast_mcp_audit_events` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `mcp_audit_client_created_idx` ON `lightfast_mcp_audit_events` (`client_public_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `mcp_authorization_client_user_idx` ON `lightfast_mcp_oauth_authorization_codes` (`client_public_id`,`clerk_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `mcp_redirect_uris_client_idx` ON `lightfast_mcp_oauth_client_redirect_uris` (`client_public_id`);--> statement-breakpoint
CREATE INDEX `mcp_grants_lookup_idx` ON `lightfast_mcp_oauth_grants` (`clerk_user_id`,`clerk_org_id`,`client_public_id`,`resource_hash`,`status`);--> statement-breakpoint
CREATE INDEX `mcp_grants_org_active_idx` ON `lightfast_mcp_oauth_grants` (`clerk_org_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `mcp_refresh_grant_status_idx` ON `lightfast_mcp_oauth_refresh_tokens` (`grant_public_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `mcp_registration_client_status_idx` ON `lightfast_mcp_oauth_registration_tokens` (`client_public_id`,`status`);--> statement-breakpoint
CREATE INDEX `signals_mcp_attribution_idx` ON `lightfast_signals` (`created_by_mcp_client_id`,`created_by_mcp_grant_id`);