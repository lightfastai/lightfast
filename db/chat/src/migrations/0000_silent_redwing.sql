CREATE TABLE `lightfast_chat_session` (
	`id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'New Session',
	`pinned` boolean NOT NULL DEFAULT false,
	`is_temporary` boolean NOT NULL DEFAULT false,
	`active_stream_id` varchar(191),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_chat_session_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_chat_message` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`role` varchar(20) NOT NULL,
	`parts` json NOT NULL,
	`char_count` int NOT NULL DEFAULT 0,
	`token_count` int,
	`model_id` varchar(100),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_chat_message_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_chat_message_feedback` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`message_id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`feedback_type` varchar(20) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_chat_message_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_chat_stream` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_chat_stream_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_chat_artifact` (
	`id` varchar(191) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`title` varchar(255) NOT NULL,
	`content` json,
	`kind` varchar(20) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`message_id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	CONSTRAINT `lightfast_chat_artifact_id_created_at_pk` PRIMARY KEY(`id`,`created_at`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_chat_usage` (
	`id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`period` varchar(10) NOT NULL,
	`non_premium_messages` int NOT NULL DEFAULT 0,
	`premium_messages` int NOT NULL DEFAULT 0,
	`attachment_count` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_chat_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_period_idx` UNIQUE(`clerk_user_id`,`period`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_chat_quota_reservation` (
	`id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`message_id` varchar(191) NOT NULL,
	`model_id` varchar(191) NOT NULL,
	`message_type` varchar(10) NOT NULL,
	`period` varchar(10) NOT NULL,
	`status` varchar(10) NOT NULL DEFAULT 'reserved',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`completed_at` datetime,
	CONSTRAINT `lightfast_chat_quota_reservation_id` PRIMARY KEY(`id`),
	CONSTRAINT `message_id_idx` UNIQUE(`message_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_chat_session_share` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`revoked_at` datetime,
	`expires_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_chat_session_share_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_chat_attachment` (
	`id` varchar(191) NOT NULL,
	`user_id` varchar(191) NOT NULL,
	`storage_path` varchar(512) NOT NULL,
	`filename` varchar(256),
	`content_type` varchar(128),
	`size` bigint NOT NULL,
	`metadata` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_chat_attachment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `session_id_created_at_idx` ON `lightfast_chat_message` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_period_idx` ON `lightfast_chat_quota_reservation` (`clerk_user_id`,`period`);--> statement-breakpoint
CREATE INDEX `status_created_idx` ON `lightfast_chat_quota_reservation` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `model_id_idx` ON `lightfast_chat_quota_reservation` (`model_id`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `lightfast_chat_attachment` (`user_id`);