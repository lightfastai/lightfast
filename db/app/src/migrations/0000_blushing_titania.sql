CREATE TABLE `lightfast_org_automation_runs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`automation_id` bigint unsigned NOT NULL,
	`automation_public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`trigger` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`due_at` datetime(3) NOT NULL,
	`started_at` datetime(3),
	`finished_at` datetime(3),
	`schedule_version` int unsigned NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`output` json,
	`error_code` varchar(64),
	`error_message` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_automation_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_automation_runs_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_automation_runs_idempotency_key_uq` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_automations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`prompt` text NOT NULL,
	`schedule_kind` varchar(32) NOT NULL,
	`schedule_config` json NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`status` varchar(32) NOT NULL,
	`next_run_at` datetime(3),
	`last_run_at` datetime(3),
	`schedule_version` int unsigned NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_automations_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_automations_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_connector_connections` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`current_org_provider_key` varchar(97),
	`provider` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`connected_by_user_id` varchar(64) NOT NULL,
	`connected_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`revoked_at` datetime(3),
	`provider_workspace_id` varchar(128),
	`provider_workspace_name` varchar(128),
	`provider_actor_id` varchar(128),
	`provider_actor_name` varchar(128),
	`encrypted_access_token` text,
	`encrypted_refresh_token` text,
	`access_token_expires_at` datetime(3),
	`refresh_token_expires_at` datetime(3),
	`scopes` json NOT NULL,
	`mcp_endpoint` varchar(512) NOT NULL,
	`tool_manifest` json NOT NULL,
	`last_tool_refresh_at` datetime(3),
	`last_tool_refresh_error_at` datetime(3),
	`last_tool_refresh_error_code` varchar(32),
	`enabled_for_automations` boolean NOT NULL DEFAULT false,
	`enabled_for_agents` boolean NOT NULL DEFAULT false,
	`metadata` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_connector_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_connector_connections_current_org_provider_uq` UNIQUE(`current_org_provider_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_identity_index_files` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`identity_index_state_id` bigint unsigned NOT NULL,
	`indexed_commit_sha` varchar(64),
	`kind` varchar(64) NOT NULL,
	`path` varchar(512) NOT NULL,
	`status` varchar(64) NOT NULL,
	`source_markdown` mediumtext,
	`content_hash` varchar(128),
	`content_sha` varchar(64),
	`content_size` int unsigned,
	`diagnostics` json NOT NULL DEFAULT (JSON_ARRAY()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_identity_index_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_identity_index_files_state_kind_uq` UNIQUE(`identity_index_state_id`,`kind`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_identity_index_states` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`source_control_repository_id` bigint unsigned NOT NULL,
	`indexed_commit_sha` varchar(64),
	`indexed_tree_sha` varchar(64),
	`indexed_at` datetime(3),
	`present_file_count` int unsigned NOT NULL DEFAULT 0,
	`missing_file_count` int unsigned NOT NULL DEFAULT 0,
	`too_large_file_count` int unsigned NOT NULL DEFAULT 0,
	`read_error_file_count` int unsigned NOT NULL DEFAULT 0,
	`last_checked_commit_sha` varchar(64),
	`last_checked_at` datetime(3),
	`github_ref_etag` varchar(256),
	`last_refresh_status` varchar(64) NOT NULL DEFAULT 'never',
	`last_refresh_error_code` varchar(64),
	`last_refresh_error_message` varchar(512),
	`last_refresh_succeeded_at` datetime(3),
	`last_refresh_failed_at` datetime(3),
	`index_diagnostics` json NOT NULL DEFAULT (JSON_ARRAY()),
	`refresh_lock_token` varchar(128),
	`refresh_locked_until` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_identity_index_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_identity_index_states_source_control_repository_uq` UNIQUE(`source_control_repository_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_people` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`display_name` varchar(160),
	`identity_provider` varchar(32) NOT NULL,
	`identity_type` varchar(32) NOT NULL,
	`identity_value` text NOT NULL,
	`normalized_identity_value` varchar(512) NOT NULL,
	`identity_key` varchar(64) NOT NULL,
	`first_seen_signal_id` varchar(64),
	`last_seen_signal_id` varchar(64),
	`seen_count` int unsigned NOT NULL DEFAULT 1,
	`metadata` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_people_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_people_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_people_org_identity_key_uq` UNIQUE(`clerk_org_id`,`identity_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_people_views` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`config` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_people_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_people_views_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_provider_routine_calls` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`called_by_kind` varchar(32) NOT NULL,
	`called_by_id` varchar(128) NOT NULL,
	`called_by_user_id` varchar(64),
	`provider` varchar(32) NOT NULL,
	`routine_id` varchar(128) NOT NULL,
	`provider_tool_name` varchar(128) NOT NULL,
	`provider_connection_id` bigint unsigned NOT NULL,
	`provider_workspace_id` varchar(128),
	`provider_actor_id` varchar(128),
	`provider_attempted` boolean NOT NULL DEFAULT false,
	`source_surface` varchar(32) NOT NULL DEFAULT 'system',
	`source_ref` varchar(128),
	`source_client_id` varchar(128),
	`status` varchar(32) NOT NULL,
	`input_redacted` json,
	`output_redacted` json,
	`error_code` varchar(64),
	`error_message` text,
	`started_at` datetime(3) NOT NULL,
	`finished_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_provider_routine_calls_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_provider_routine_calls_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_signal_views` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`config` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_signal_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_signal_views_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_signals` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`created_by_api_key_id` varchar(128),
	`created_by_mcp_client_id` varchar(128),
	`created_by_mcp_grant_id` varchar(128),
	`visibility_scope` varchar(32) NOT NULL DEFAULT 'user',
	`input` text NOT NULL,
	`status` varchar(32) NOT NULL,
	`classification` json,
	`classification_metadata` json,
	`error_code` varchar(64),
	`error_message` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_signals_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_signals_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_skill_index_entries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`skill_index_state_id` bigint unsigned NOT NULL,
	`indexed_commit_sha` varchar(64) NOT NULL,
	`slug` varchar(63) NOT NULL,
	`path` varchar(512) NOT NULL,
	`name` varchar(63),
	`description` varchar(1024),
	`license` varchar(256),
	`compatibility` varchar(512),
	`allowed_tools` varchar(2048),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`source_markdown` mediumtext,
	`body_markdown` mediumtext,
	`content_sha` varchar(64) NOT NULL,
	`content_size` int unsigned,
	`validation_status` varchar(64) NOT NULL,
	`diagnostics` json NOT NULL DEFAULT (JSON_ARRAY()),
	`resources` json NOT NULL,
	`resources_truncated` int unsigned NOT NULL DEFAULT 0,
	`non_standard_resource_count` int unsigned NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_skill_index_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_skill_index_entries_state_slug_uq` UNIQUE(`skill_index_state_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_skill_index_states` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`source_control_repository_id` bigint unsigned NOT NULL,
	`indexed_commit_sha` varchar(64),
	`indexed_tree_sha` varchar(64),
	`indexed_at` datetime(3),
	`skill_count` int unsigned NOT NULL DEFAULT 0,
	`invalid_skill_count` int unsigned NOT NULL DEFAULT 0,
	`last_checked_commit_sha` varchar(64),
	`last_checked_at` datetime(3),
	`github_ref_etag` varchar(256),
	`last_refresh_status` varchar(64) NOT NULL DEFAULT 'never',
	`last_refresh_error_code` varchar(64),
	`last_refresh_error_message` varchar(512),
	`last_refresh_failed_at` datetime(3),
	`index_diagnostics` json NOT NULL DEFAULT (JSON_ARRAY()),
	`refresh_lock_token` varchar(128),
	`refresh_locked_until` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_skill_index_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_skill_index_states_source_control_repository_uq` UNIQUE(`source_control_repository_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_source_control_bindings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`active_clerk_org_id` varchar(64),
	`provider` varchar(32) NOT NULL,
	`provider_account_id` varchar(128),
	`provider_account_login` varchar(128),
	`provider_installation_id` varchar(128),
	`status` varchar(32) NOT NULL,
	`connected_by_user_id` varchar(64) NOT NULL,
	`connected_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`revoked_at` datetime(3),
	`metadata` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_source_control_bindings_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_source_control_bindings_active_per_org_uq` UNIQUE(`active_clerk_org_id`),
	CONSTRAINT `org_source_control_bindings_installation_uq` UNIQUE(`provider_installation_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_source_control_repositories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_source_control_binding_id` bigint unsigned NOT NULL,
	`provider_repository_id` varchar(128) NOT NULL,
	`full_name` varchar(256) NOT NULL,
	`watched_path_globs` json,
	`sync_status` varchar(64) NOT NULL DEFAULT 'enabled',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_source_control_repositories_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_source_control_repositories_binding_repository_uq` UNIQUE(`org_source_control_binding_id`,`provider_repository_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_source_control_webhook_deliveries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`delivery_id` varchar(128) NOT NULL,
	`event` varchar(64) NOT NULL,
	`provider_installation_id` varchar(128) NOT NULL,
	`provider_repository_id` varchar(128) NOT NULL,
	`status` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_source_control_webhook_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_source_control_webhook_deliveries_delivery_id_uq` UNIQUE(`delivery_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_workspace_assistant_context_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`message_id` bigint unsigned,
	`clerk_org_id` varchar(64) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`source_public_id` varchar(128),
	`source_slug` varchar(128),
	`title` varchar(160),
	`snapshot` json NOT NULL,
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_workspace_assistant_context_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_workspace_assistant_context_items_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_workspace_assistant_conversations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`title` varchar(160),
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`active_stream_id` varchar(80),
	`last_message_id` bigint unsigned,
	`last_message_at` datetime(3),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_workspace_assistant_conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_workspace_assistant_conversations_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_workspace_assistant_generations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`assistant_message_id` bigint unsigned NOT NULL,
	`assistant_message_public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`requested_by_user_id` varchar(64) NOT NULL,
	`model` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`finish_reason` varchar(32),
	`usage` json,
	`provider_metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`request_metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`error_code` varchar(64),
	`error_message` text,
	`started_at` datetime(3),
	`finished_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_workspace_assistant_generations_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_workspace_assistant_generations_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_workspace_assistant_generations_assistant_message_uq` UNIQUE(`assistant_message_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_workspace_assistant_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`conversation_public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`role` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'completed',
	`sequence` int unsigned NOT NULL,
	`idempotency_key` varchar(128),
	`parts` json NOT NULL DEFAULT (JSON_ARRAY()),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`error_code` varchar(64),
	`error_message` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_workspace_assistant_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_workspace_assistant_messages_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_workspace_assistant_messages_conversation_sequence_uq` UNIQUE(`conversation_id`,`sequence`),
	CONSTRAINT `org_workspace_assistant_messages_conv_idempotency_key_uq` UNIQUE(`conversation_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_workspace_assistant_tool_calls` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`generation_id` bigint unsigned NOT NULL,
	`generation_public_id` varchar(80) NOT NULL,
	`message_id` bigint unsigned NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`tool_call_id` varchar(128) NOT NULL,
	`tool_name` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`input` json DEFAULT (JSON_OBJECT()),
	`output` json,
	`error_code` varchar(64),
	`error_message` text,
	`started_at` datetime(3),
	`finished_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_workspace_assistant_tool_calls_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_workspace_assistant_tool_calls_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_workspace_assistant_tool_calls_generation_tool_call_uq` UNIQUE(`generation_id`,`tool_call_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_system_mcp_audit_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`event_name` varchar(128) NOT NULL,
	`outcome` varchar(32) NOT NULL,
	`clerk_org_id` varchar(64),
	`clerk_user_id` varchar(64),
	`client_public_id` varchar(128),
	`grant_public_id` varchar(128),
	`metadata` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_system_mcp_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_system_mcp_oauth_authorization_codes` (
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
	`expires_at` datetime(3) NOT NULL,
	`consumed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_system_mcp_oauth_authorization_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_mcp_authorization_codes_hash_uq` UNIQUE(`code_hash`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_system_mcp_oauth_client_redirect_uris` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`client_public_id` varchar(128) NOT NULL,
	`redirect_uri` varchar(2048) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_system_mcp_oauth_client_redirect_uris_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_system_mcp_oauth_clients` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_client_id` varchar(128) NOT NULL,
	`client_name` varchar(255) NOT NULL,
	`client_uri` varchar(2048),
	`logo_uri` varchar(2048),
	`contacts` json,
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`metadata` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_system_mcp_oauth_clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_mcp_oauth_clients_public_id_uq` UNIQUE(`public_client_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_system_mcp_oauth_grants` (
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
	`last_used_at` datetime(3),
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_system_mcp_oauth_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_mcp_grants_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_system_mcp_oauth_refresh_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`grant_public_id` varchar(128) NOT NULL,
	`client_public_id` varchar(128) NOT NULL,
	`clerk_user_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`parent_token_hash` varchar(128),
	`rotated_to_token_hash` varchar(128),
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`expires_at` datetime(3) NOT NULL,
	`reuse_detected_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_system_mcp_oauth_refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_mcp_refresh_token_hash_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_system_mcp_oauth_registration_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(128) NOT NULL,
	`client_public_id` varchar(128) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`expires_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_system_mcp_oauth_registration_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_mcp_registration_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `system_mcp_registration_token_hash_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_system_namespace_operations` (
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
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` datetime(3),
	CONSTRAINT `lightfast_system_namespace_operations_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_namespace_operations_org_idempotency_uq` UNIQUE(`idempotency_clerk_org_id`,`operation_type`,`idempotency_key`),
	CONSTRAINT `system_namespace_operations_user_idempotency_uq` UNIQUE(`idempotency_clerk_user_id`,`operation_type`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_system_namespaces` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`handle` varchar(64) NOT NULL,
	`kind` varchar(48) NOT NULL,
	`clerk_user_id` varchar(64),
	`clerk_org_id` varchar(64),
	`claimed_clerk_user_id` varchar(64),
	`claimed_clerk_org_id` varchar(64),
	`status` varchar(48) NOT NULL,
	`active_operation_id` bigint unsigned,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_system_namespaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_namespaces_active_operation_uq` UNIQUE(`active_operation_id`),
	CONSTRAINT `system_namespaces_claimed_org_uq` UNIQUE(`claimed_clerk_org_id`),
	CONSTRAINT `system_namespaces_claimed_user_uq` UNIQUE(`claimed_clerk_user_id`),
	CONSTRAINT `system_namespaces_handle_uq` UNIQUE(`handle`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_user_source_control_accounts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`clerk_user_id` varchar(64) NOT NULL,
	`active_clerk_user_id` varchar(64),
	`active_provider_user_key` varchar(192),
	`provider` varchar(32) NOT NULL,
	`provider_user_id` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`connected_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`revoked_at` datetime(3),
	`encrypted_access_token` text NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`access_token_expires_at` datetime(3) NOT NULL,
	`refresh_token_expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_user_source_control_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_source_control_accounts_active_user_uq` UNIQUE(`active_clerk_user_id`),
	CONSTRAINT `user_source_control_accounts_active_provider_user_uq` UNIQUE(`active_provider_user_key`)
);
--> statement-breakpoint
CREATE INDEX `org_automation_runs_automation_created_idx` ON `lightfast_org_automation_runs` (`automation_public_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_automation_runs_org_status_created_idx` ON `lightfast_org_automation_runs` (`clerk_org_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_automations_org_status_next_run_idx` ON `lightfast_org_automations` (`clerk_org_id`,`status`,`next_run_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_automations_due_idx` ON `lightfast_org_automations` (`status`,`next_run_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_connector_connections_org_provider_status_idx` ON `lightfast_org_connector_connections` (`clerk_org_id`,`provider`,`status`);--> statement-breakpoint
CREATE INDEX `org_connector_connections_provider_workspace_idx` ON `lightfast_org_connector_connections` (`provider`,`provider_workspace_id`);--> statement-breakpoint
CREATE INDEX `org_identity_index_files_state_status_idx` ON `lightfast_org_identity_index_files` (`identity_index_state_id`,`status`);--> statement-breakpoint
CREATE INDEX `org_identity_index_states_last_checked_idx` ON `lightfast_org_identity_index_states` (`last_checked_at`);--> statement-breakpoint
CREATE INDEX `org_identity_index_states_refresh_locked_until_idx` ON `lightfast_org_identity_index_states` (`refresh_locked_until`);--> statement-breakpoint
CREATE INDEX `org_people_org_created_idx` ON `lightfast_org_people` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_people_views_org_user_created_idx` ON `lightfast_org_people_views` (`clerk_org_id`,`created_by_user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_provider_routine_calls_org_created_idx` ON `lightfast_org_provider_routine_calls` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_provider_routine_calls_org_caller_created_idx` ON `lightfast_org_provider_routine_calls` (`clerk_org_id`,`called_by_kind`,`called_by_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_provider_routine_calls_connection_created_idx` ON `lightfast_org_provider_routine_calls` (`provider_connection_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_provider_routine_calls_provider_routine_created_idx` ON `lightfast_org_provider_routine_calls` (`provider`,`routine_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_signal_views_org_user_created_idx` ON `lightfast_org_signal_views` (`clerk_org_id`,`created_by_user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_signals_org_created_idx` ON `lightfast_org_signals` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_signals_org_status_created_idx` ON `lightfast_org_signals` (`clerk_org_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_signals_org_visibility_created_idx` ON `lightfast_org_signals` (`clerk_org_id`,`visibility_scope`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_signals_mcp_attribution_idx` ON `lightfast_org_signals` (`created_by_mcp_client_id`,`created_by_mcp_grant_id`);--> statement-breakpoint
CREATE INDEX `org_skill_index_entries_state_validation_idx` ON `lightfast_org_skill_index_entries` (`skill_index_state_id`,`validation_status`);--> statement-breakpoint
CREATE INDEX `org_skill_index_states_last_checked_idx` ON `lightfast_org_skill_index_states` (`last_checked_at`);--> statement-breakpoint
CREATE INDEX `org_skill_index_states_refresh_locked_until_idx` ON `lightfast_org_skill_index_states` (`refresh_locked_until`);--> statement-breakpoint
CREATE INDEX `org_source_control_bindings_org_status_idx` ON `lightfast_org_source_control_bindings` (`clerk_org_id`,`status`);--> statement-breakpoint
CREATE INDEX `org_source_control_bindings_provider_account_idx` ON `lightfast_org_source_control_bindings` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `org_source_control_repositories_provider_repository_idx` ON `lightfast_org_source_control_repositories` (`provider_repository_id`);--> statement-breakpoint
CREATE INDEX `org_source_control_webhook_deliveries_installation_repo_idx` ON `lightfast_org_source_control_webhook_deliveries` (`provider_installation_id`,`provider_repository_id`);--> statement-breakpoint
CREATE INDEX `org_source_control_webhook_deliveries_status_updated_idx` ON `lightfast_org_source_control_webhook_deliveries` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_context_items_conversation_kind_idx` ON `lightfast_org_workspace_assistant_context_items` (`conversation_id`,`kind`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_context_items_message_kind_idx` ON `lightfast_org_workspace_assistant_context_items` (`message_id`,`kind`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_context_items_org_created_idx` ON `lightfast_org_workspace_assistant_context_items` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_conversations_user_status_updated_idx` ON `lightfast_org_workspace_assistant_conversations` (`clerk_org_id`,`created_by_user_id`,`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_conversations_org_created_idx` ON `lightfast_org_workspace_assistant_conversations` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_generations_org_status_idx` ON `lightfast_org_workspace_assistant_generations` (`clerk_org_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_generations_org_user_status_idx` ON `lightfast_org_workspace_assistant_generations` (`clerk_org_id`,`requested_by_user_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_generations_conversation_created_idx` ON `lightfast_org_workspace_assistant_generations` (`conversation_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_messages_conversation_created_idx` ON `lightfast_org_workspace_assistant_messages` (`conversation_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_messages_user_conversation_sequence_idx` ON `lightfast_org_workspace_assistant_messages` (`clerk_org_id`,`created_by_user_id`,`conversation_id`,`sequence`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_messages_org_created_idx` ON `lightfast_org_workspace_assistant_messages` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_tool_calls_message_idx` ON `lightfast_org_workspace_assistant_tool_calls` (`message_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_workspace_assistant_tool_calls_org_created_idx` ON `lightfast_org_workspace_assistant_tool_calls` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `system_mcp_audit_org_created_idx` ON `lightfast_system_mcp_audit_events` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `system_mcp_audit_client_created_idx` ON `lightfast_system_mcp_audit_events` (`client_public_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `system_mcp_authorization_client_user_idx` ON `lightfast_system_mcp_oauth_authorization_codes` (`client_public_id`,`clerk_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `system_mcp_redirect_uris_client_idx` ON `lightfast_system_mcp_oauth_client_redirect_uris` (`client_public_id`);--> statement-breakpoint
CREATE INDEX `system_mcp_grants_lookup_idx` ON `lightfast_system_mcp_oauth_grants` (`clerk_user_id`,`clerk_org_id`,`client_public_id`,`resource_hash`,`status`);--> statement-breakpoint
CREATE INDEX `system_mcp_grants_org_active_idx` ON `lightfast_system_mcp_oauth_grants` (`clerk_org_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `system_mcp_refresh_grant_status_idx` ON `lightfast_system_mcp_oauth_refresh_tokens` (`grant_public_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `system_mcp_registration_client_status_idx` ON `lightfast_system_mcp_oauth_registration_tokens` (`client_public_id`,`status`);--> statement-breakpoint
CREATE INDEX `system_namespace_operations_org_idx` ON `lightfast_system_namespace_operations` (`clerk_org_id`,`status`);--> statement-breakpoint
CREATE INDEX `system_namespace_operations_status_idx` ON `lightfast_system_namespace_operations` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `system_namespace_operations_user_idx` ON `lightfast_system_namespace_operations` (`clerk_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `system_namespaces_org_idx` ON `lightfast_system_namespaces` (`clerk_org_id`,`status`);--> statement-breakpoint
CREATE INDEX `system_namespaces_user_idx` ON `lightfast_system_namespaces` (`clerk_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `user_source_control_accounts_user_status_idx` ON `lightfast_user_source_control_accounts` (`clerk_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `user_source_control_accounts_provider_user_idx` ON `lightfast_user_source_control_accounts` (`provider`,`provider_user_id`);