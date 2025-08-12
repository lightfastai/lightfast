ALTER TABLE `lightfast_chat_session` ADD `title` varchar(255) DEFAULT 'New Session' NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_chat_session` ADD `pinned` boolean DEFAULT false NOT NULL;