CREATE TABLE `lightfast_chat_message` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`role` varchar(20) NOT NULL,
	`parts` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lightfast_chat_message_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_chat_session` (
	`id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lightfast_chat_session_id` PRIMARY KEY(`id`)
);
