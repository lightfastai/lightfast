CREATE TABLE `lightfast_chat_artifact` (
	`id` varchar(191) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`title` varchar(255) NOT NULL,
	`content` json,
	`kind` varchar(20) NOT NULL DEFAULT 'code',
	`session_id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	CONSTRAINT `lightfast_chat_artifact_id_created_at_pk` PRIMARY KEY(`id`,`created_at`)
);
