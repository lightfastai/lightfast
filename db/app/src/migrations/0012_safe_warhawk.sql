CREATE TABLE `lightfast_namespace_operations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`operation_type` varchar(48) NOT NULL,
	`owner_kind` varchar(48) NOT NULL,
	`clerk_user_id` varchar(64),
	`clerk_org_id` varchar(64),
	`idempotency_clerk_user_id` varchar(64),
	`idempotency_clerk_org_id` varchar(64),
	`from_handle` varchar(64),
	`to_handle` varchar(64) NOT NULL,
	`status` varchar(48) NOT NULL,
	`idempotency_key` varchar(128) NOT NULL,
	`error_code` varchar(64),
	`error_message` varchar(512),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` timestamp(3),
	CONSTRAINT `lightfast_namespace_operations_id` PRIMARY KEY(`id`),
	CONSTRAINT `namespace_operations_org_idempotency_uq` UNIQUE(`idempotency_clerk_org_id`,`operation_type`,`idempotency_key`),
	CONSTRAINT `namespace_operations_user_idempotency_uq` UNIQUE(`idempotency_clerk_user_id`,`operation_type`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_namespaces` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`handle` varchar(64) NOT NULL,
	`kind` varchar(48) NOT NULL,
	`clerk_user_id` varchar(64),
	`clerk_org_id` varchar(64),
	`claimed_clerk_user_id` varchar(64),
	`claimed_clerk_org_id` varchar(64),
	`status` varchar(48) NOT NULL,
	`active_operation_id` bigint unsigned,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_namespaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `namespaces_active_operation_uq` UNIQUE(`active_operation_id`),
	CONSTRAINT `namespaces_claimed_org_uq` UNIQUE(`claimed_clerk_org_id`),
	CONSTRAINT `namespaces_claimed_user_uq` UNIQUE(`claimed_clerk_user_id`),
	CONSTRAINT `namespaces_handle_uq` UNIQUE(`handle`)
);
--> statement-breakpoint
CREATE INDEX `namespace_operations_org_idx` ON `lightfast_namespace_operations` (`clerk_org_id`,`status`);--> statement-breakpoint
CREATE INDEX `namespace_operations_status_idx` ON `lightfast_namespace_operations` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `namespace_operations_user_idx` ON `lightfast_namespace_operations` (`clerk_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `namespaces_org_idx` ON `lightfast_namespaces` (`clerk_org_id`,`status`);--> statement-breakpoint
CREATE INDEX `namespaces_user_idx` ON `lightfast_namespaces` (`clerk_user_id`,`status`);