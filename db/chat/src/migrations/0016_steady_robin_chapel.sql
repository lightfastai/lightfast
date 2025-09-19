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
