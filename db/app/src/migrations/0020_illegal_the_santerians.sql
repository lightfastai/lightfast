RENAME TABLE `lightfast_automation_runs` TO `lightfast_org_automation_runs`;--> statement-breakpoint
RENAME TABLE `lightfast_automations` TO `lightfast_org_automations`;--> statement-breakpoint
RENAME TABLE `lightfast_identity_index_files` TO `lightfast_org_identity_index_files`;--> statement-breakpoint
RENAME TABLE `lightfast_identity_index_states` TO `lightfast_org_identity_index_states`;--> statement-breakpoint
RENAME TABLE `lightfast_people` TO `lightfast_org_people`;--> statement-breakpoint
RENAME TABLE `lightfast_people_views` TO `lightfast_org_people_views`;--> statement-breakpoint
RENAME TABLE `lightfast_provider_routine_calls` TO `lightfast_org_provider_routine_calls`;--> statement-breakpoint
RENAME TABLE `lightfast_signal_views` TO `lightfast_org_signal_views`;--> statement-breakpoint
RENAME TABLE `lightfast_signals` TO `lightfast_org_signals`;--> statement-breakpoint
RENAME TABLE `lightfast_skill_index_entries` TO `lightfast_org_skill_index_entries`;--> statement-breakpoint
RENAME TABLE `lightfast_skill_index_states` TO `lightfast_org_skill_index_states`;--> statement-breakpoint
RENAME TABLE `lightfast_source_control_repositories` TO `lightfast_org_source_control_repositories`;--> statement-breakpoint
RENAME TABLE `lightfast_source_control_webhook_deliveries` TO `lightfast_org_source_control_webhook_deliveries`;--> statement-breakpoint
RENAME TABLE `lightfast_workspace_assistant_context_items` TO `lightfast_org_workspace_assistant_context_items`;--> statement-breakpoint
RENAME TABLE `lightfast_workspace_assistant_conversations` TO `lightfast_org_workspace_assistant_conversations`;--> statement-breakpoint
RENAME TABLE `lightfast_workspace_assistant_generations` TO `lightfast_org_workspace_assistant_generations`;--> statement-breakpoint
RENAME TABLE `lightfast_workspace_assistant_messages` TO `lightfast_org_workspace_assistant_messages`;--> statement-breakpoint
RENAME TABLE `lightfast_workspace_assistant_tool_calls` TO `lightfast_org_workspace_assistant_tool_calls`;--> statement-breakpoint
RENAME TABLE `lightfast_mcp_audit_events` TO `lightfast_system_mcp_audit_events`;--> statement-breakpoint
RENAME TABLE `lightfast_mcp_oauth_authorization_codes` TO `lightfast_system_mcp_oauth_authorization_codes`;--> statement-breakpoint
RENAME TABLE `lightfast_mcp_oauth_client_redirect_uris` TO `lightfast_system_mcp_oauth_client_redirect_uris`;--> statement-breakpoint
RENAME TABLE `lightfast_mcp_oauth_clients` TO `lightfast_system_mcp_oauth_clients`;--> statement-breakpoint
RENAME TABLE `lightfast_mcp_oauth_grants` TO `lightfast_system_mcp_oauth_grants`;--> statement-breakpoint
RENAME TABLE `lightfast_mcp_oauth_refresh_tokens` TO `lightfast_system_mcp_oauth_refresh_tokens`;--> statement-breakpoint
RENAME TABLE `lightfast_mcp_oauth_registration_tokens` TO `lightfast_system_mcp_oauth_registration_tokens`;--> statement-breakpoint
RENAME TABLE `lightfast_namespace_operations` TO `lightfast_system_namespace_operations`;--> statement-breakpoint
RENAME TABLE `lightfast_namespaces` TO `lightfast_system_namespaces`;--> statement-breakpoint
ALTER TABLE `lightfast_org_automation_runs` DROP INDEX `automation_runs_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_automation_runs` DROP INDEX `automation_runs_idempotency_key_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_automations` DROP INDEX `automations_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_files` DROP INDEX `identity_index_files_state_kind_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_states` DROP INDEX `identity_index_states_source_control_repository_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_authorization_codes` DROP INDEX `mcp_authorization_codes_hash_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_clients` DROP INDEX `mcp_oauth_clients_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_grants` DROP INDEX `mcp_grants_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_refresh_tokens` DROP INDEX `mcp_refresh_token_hash_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_registration_tokens` DROP INDEX `mcp_registration_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_registration_tokens` DROP INDEX `mcp_registration_token_hash_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_namespace_operations` DROP INDEX `namespace_operations_org_idempotency_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_namespace_operations` DROP INDEX `namespace_operations_user_idempotency_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_namespaces` DROP INDEX `namespaces_active_operation_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_namespaces` DROP INDEX `namespaces_claimed_org_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_namespaces` DROP INDEX `namespaces_claimed_user_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_system_namespaces` DROP INDEX `namespaces_handle_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_people` DROP INDEX `people_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_people` DROP INDEX `people_org_identity_key_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_people_views` DROP INDEX `people_views_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_provider_routine_calls` DROP INDEX `provider_routine_calls_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_signal_views` DROP INDEX `signal_views_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_signals` DROP INDEX `signals_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_entries` DROP INDEX `skill_index_entries_state_slug_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_states` DROP INDEX `skill_index_states_source_control_repository_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_repositories` DROP INDEX `source_control_repositories_binding_repository_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_webhook_deliveries` DROP INDEX `source_control_webhook_deliveries_delivery_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_context_items` DROP INDEX `workspace_assistant_context_items_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_conversations` DROP INDEX `workspace_assistant_conversations_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_generations` DROP INDEX `workspace_assistant_generations_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_generations` DROP INDEX `workspace_assistant_generations_assistant_message_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_messages` DROP INDEX `workspace_assistant_messages_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_messages` DROP INDEX `workspace_assistant_messages_conversation_sequence_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_messages` DROP INDEX `workspace_assistant_messages_conversation_idempotency_key_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_tool_calls` DROP INDEX `workspace_assistant_tool_calls_public_id_uq`;--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_tool_calls` DROP INDEX `workspace_assistant_tool_calls_generation_tool_call_uq`;--> statement-breakpoint
DROP INDEX `automation_runs_automation_created_idx` ON `lightfast_org_automation_runs`;--> statement-breakpoint
DROP INDEX `automation_runs_org_status_created_idx` ON `lightfast_org_automation_runs`;--> statement-breakpoint
DROP INDEX `automations_org_status_next_run_idx` ON `lightfast_org_automations`;--> statement-breakpoint
DROP INDEX `automations_due_idx` ON `lightfast_org_automations`;--> statement-breakpoint
DROP INDEX `identity_index_files_state_status_idx` ON `lightfast_org_identity_index_files`;--> statement-breakpoint
DROP INDEX `identity_index_states_last_checked_idx` ON `lightfast_org_identity_index_states`;--> statement-breakpoint
DROP INDEX `identity_index_states_refresh_locked_until_idx` ON `lightfast_org_identity_index_states`;--> statement-breakpoint
DROP INDEX `mcp_audit_org_created_idx` ON `lightfast_system_mcp_audit_events`;--> statement-breakpoint
DROP INDEX `mcp_audit_client_created_idx` ON `lightfast_system_mcp_audit_events`;--> statement-breakpoint
DROP INDEX `mcp_authorization_client_user_idx` ON `lightfast_system_mcp_oauth_authorization_codes`;--> statement-breakpoint
DROP INDEX `mcp_redirect_uris_client_idx` ON `lightfast_system_mcp_oauth_client_redirect_uris`;--> statement-breakpoint
DROP INDEX `mcp_grants_lookup_idx` ON `lightfast_system_mcp_oauth_grants`;--> statement-breakpoint
DROP INDEX `mcp_grants_org_active_idx` ON `lightfast_system_mcp_oauth_grants`;--> statement-breakpoint
DROP INDEX `mcp_refresh_grant_status_idx` ON `lightfast_system_mcp_oauth_refresh_tokens`;--> statement-breakpoint
DROP INDEX `mcp_registration_client_status_idx` ON `lightfast_system_mcp_oauth_registration_tokens`;--> statement-breakpoint
DROP INDEX `namespace_operations_org_idx` ON `lightfast_system_namespace_operations`;--> statement-breakpoint
DROP INDEX `namespace_operations_status_idx` ON `lightfast_system_namespace_operations`;--> statement-breakpoint
DROP INDEX `namespace_operations_user_idx` ON `lightfast_system_namespace_operations`;--> statement-breakpoint
DROP INDEX `namespaces_org_idx` ON `lightfast_system_namespaces`;--> statement-breakpoint
DROP INDEX `namespaces_user_idx` ON `lightfast_system_namespaces`;--> statement-breakpoint
DROP INDEX `people_org_created_idx` ON `lightfast_org_people`;--> statement-breakpoint
DROP INDEX `people_views_org_user_created_idx` ON `lightfast_org_people_views`;--> statement-breakpoint
DROP INDEX `provider_routine_calls_org_created_idx` ON `lightfast_org_provider_routine_calls`;--> statement-breakpoint
DROP INDEX `provider_routine_calls_org_caller_created_idx` ON `lightfast_org_provider_routine_calls`;--> statement-breakpoint
DROP INDEX `provider_routine_calls_connection_created_idx` ON `lightfast_org_provider_routine_calls`;--> statement-breakpoint
DROP INDEX `provider_routine_calls_provider_routine_created_idx` ON `lightfast_org_provider_routine_calls`;--> statement-breakpoint
DROP INDEX `signal_views_org_user_created_idx` ON `lightfast_org_signal_views`;--> statement-breakpoint
DROP INDEX `signals_org_created_idx` ON `lightfast_org_signals`;--> statement-breakpoint
DROP INDEX `signals_org_status_created_idx` ON `lightfast_org_signals`;--> statement-breakpoint
DROP INDEX `signals_org_visibility_created_idx` ON `lightfast_org_signals`;--> statement-breakpoint
DROP INDEX `signals_mcp_attribution_idx` ON `lightfast_org_signals`;--> statement-breakpoint
DROP INDEX `skill_index_entries_state_validation_idx` ON `lightfast_org_skill_index_entries`;--> statement-breakpoint
DROP INDEX `skill_index_states_last_checked_idx` ON `lightfast_org_skill_index_states`;--> statement-breakpoint
DROP INDEX `skill_index_states_refresh_locked_until_idx` ON `lightfast_org_skill_index_states`;--> statement-breakpoint
DROP INDEX `source_control_repositories_provider_repository_idx` ON `lightfast_org_source_control_repositories`;--> statement-breakpoint
DROP INDEX `source_control_webhook_deliveries_installation_repository_idx` ON `lightfast_org_source_control_webhook_deliveries`;--> statement-breakpoint
DROP INDEX `source_control_webhook_deliveries_status_updated_idx` ON `lightfast_org_source_control_webhook_deliveries`;--> statement-breakpoint
DROP INDEX `workspace_assistant_context_items_conversation_kind_idx` ON `lightfast_org_workspace_assistant_context_items`;--> statement-breakpoint
DROP INDEX `workspace_assistant_context_items_message_kind_idx` ON `lightfast_org_workspace_assistant_context_items`;--> statement-breakpoint
DROP INDEX `workspace_assistant_context_items_org_created_idx` ON `lightfast_org_workspace_assistant_context_items`;--> statement-breakpoint
DROP INDEX `workspace_assistant_conversations_org_user_status_updated_idx` ON `lightfast_org_workspace_assistant_conversations`;--> statement-breakpoint
DROP INDEX `workspace_assistant_conversations_org_created_idx` ON `lightfast_org_workspace_assistant_conversations`;--> statement-breakpoint
DROP INDEX `workspace_assistant_generations_org_status_idx` ON `lightfast_org_workspace_assistant_generations`;--> statement-breakpoint
DROP INDEX `workspace_assistant_generations_org_user_status_idx` ON `lightfast_org_workspace_assistant_generations`;--> statement-breakpoint
DROP INDEX `workspace_assistant_generations_conversation_created_idx` ON `lightfast_org_workspace_assistant_generations`;--> statement-breakpoint
DROP INDEX `workspace_assistant_messages_conversation_created_idx` ON `lightfast_org_workspace_assistant_messages`;--> statement-breakpoint
DROP INDEX `workspace_assistant_messages_org_user_conversation_sequence_idx` ON `lightfast_org_workspace_assistant_messages`;--> statement-breakpoint
DROP INDEX `workspace_assistant_messages_org_created_idx` ON `lightfast_org_workspace_assistant_messages`;--> statement-breakpoint
DROP INDEX `workspace_assistant_tool_calls_message_idx` ON `lightfast_org_workspace_assistant_tool_calls`;--> statement-breakpoint
DROP INDEX `workspace_assistant_tool_calls_org_created_idx` ON `lightfast_org_workspace_assistant_tool_calls`;--> statement-breakpoint
ALTER TABLE `lightfast_org_automation_runs` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_automation_runs` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_automations` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_automations` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_files` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_files` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_states` MODIFY COLUMN `indexed_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_states` MODIFY COLUMN `last_checked_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_states` MODIFY COLUMN `last_refresh_succeeded_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_states` MODIFY COLUMN `last_refresh_failed_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_states` MODIFY COLUMN `refresh_locked_until` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_states` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_states` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_audit_events` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_authorization_codes` MODIFY COLUMN `expires_at` datetime(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_authorization_codes` MODIFY COLUMN `consumed_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_authorization_codes` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_authorization_codes` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_client_redirect_uris` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_clients` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_clients` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_grants` MODIFY COLUMN `last_used_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_grants` MODIFY COLUMN `revoked_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_grants` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_grants` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_refresh_tokens` MODIFY COLUMN `expires_at` datetime(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_refresh_tokens` MODIFY COLUMN `reuse_detected_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_refresh_tokens` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_refresh_tokens` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_registration_tokens` MODIFY COLUMN `expires_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_registration_tokens` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_registration_tokens` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespace_operations` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespace_operations` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespace_operations` MODIFY COLUMN `expires_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespaces` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespaces` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_connector_connections` MODIFY COLUMN `connected_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_connector_connections` MODIFY COLUMN `revoked_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_connector_connections` MODIFY COLUMN `access_token_expires_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_connector_connections` MODIFY COLUMN `refresh_token_expires_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_connector_connections` MODIFY COLUMN `last_tool_refresh_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_connector_connections` MODIFY COLUMN `last_tool_refresh_error_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_connector_connections` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_connector_connections` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `id` bigint unsigned AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `connected_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `revoked_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_people` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_people` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_people_views` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_people_views` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_provider_routine_calls` MODIFY COLUMN `started_at` datetime(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_org_provider_routine_calls` MODIFY COLUMN `finished_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_provider_routine_calls` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_provider_routine_calls` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_signal_views` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_signal_views` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_signals` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_signals` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_entries` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_entries` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_states` MODIFY COLUMN `indexed_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_states` MODIFY COLUMN `last_checked_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_states` MODIFY COLUMN `last_refresh_failed_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_states` MODIFY COLUMN `refresh_locked_until` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_states` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_states` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_repositories` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_repositories` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_webhook_deliveries` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_webhook_deliveries` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_user_source_control_accounts` MODIFY COLUMN `connected_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_user_source_control_accounts` MODIFY COLUMN `revoked_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_user_source_control_accounts` MODIFY COLUMN `access_token_expires_at` datetime(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_user_source_control_accounts` MODIFY COLUMN `refresh_token_expires_at` datetime(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_user_source_control_accounts` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_user_source_control_accounts` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_context_items` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_conversations` MODIFY COLUMN `last_message_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_conversations` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_conversations` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_generations` MODIFY COLUMN `started_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_generations` MODIFY COLUMN `finished_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_generations` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_generations` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_messages` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_messages` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_tool_calls` MODIFY COLUMN `started_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_tool_calls` MODIFY COLUMN `finished_at` datetime(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_tool_calls` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_tool_calls` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_automation_runs` ADD CONSTRAINT `org_automation_runs_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_automation_runs` ADD CONSTRAINT `org_automation_runs_idempotency_key_uq` UNIQUE(`idempotency_key`);--> statement-breakpoint
ALTER TABLE `lightfast_org_automations` ADD CONSTRAINT `org_automations_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_files` ADD CONSTRAINT `org_identity_index_files_state_kind_uq` UNIQUE(`identity_index_state_id`,`kind`);--> statement-breakpoint
ALTER TABLE `lightfast_org_identity_index_states` ADD CONSTRAINT `org_identity_index_states_source_control_repository_uq` UNIQUE(`source_control_repository_id`);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_authorization_codes` ADD CONSTRAINT `system_mcp_authorization_codes_hash_uq` UNIQUE(`code_hash`);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_clients` ADD CONSTRAINT `system_mcp_oauth_clients_public_id_uq` UNIQUE(`public_client_id`);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_grants` ADD CONSTRAINT `system_mcp_grants_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_refresh_tokens` ADD CONSTRAINT `system_mcp_refresh_token_hash_uq` UNIQUE(`token_hash`);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_registration_tokens` ADD CONSTRAINT `system_mcp_registration_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_system_mcp_oauth_registration_tokens` ADD CONSTRAINT `system_mcp_registration_token_hash_uq` UNIQUE(`token_hash`);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespace_operations` ADD CONSTRAINT `system_namespace_operations_org_idempotency_uq` UNIQUE(`idempotency_clerk_org_id`,`operation_type`,`idempotency_key`);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespace_operations` ADD CONSTRAINT `system_namespace_operations_user_idempotency_uq` UNIQUE(`idempotency_clerk_user_id`,`operation_type`,`idempotency_key`);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespaces` ADD CONSTRAINT `system_namespaces_active_operation_uq` UNIQUE(`active_operation_id`);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespaces` ADD CONSTRAINT `system_namespaces_claimed_org_uq` UNIQUE(`claimed_clerk_org_id`);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespaces` ADD CONSTRAINT `system_namespaces_claimed_user_uq` UNIQUE(`claimed_clerk_user_id`);--> statement-breakpoint
ALTER TABLE `lightfast_system_namespaces` ADD CONSTRAINT `system_namespaces_handle_uq` UNIQUE(`handle`);--> statement-breakpoint
ALTER TABLE `lightfast_org_people` ADD CONSTRAINT `org_people_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_people` ADD CONSTRAINT `org_people_org_identity_key_uq` UNIQUE(`clerk_org_id`,`identity_key`);--> statement-breakpoint
ALTER TABLE `lightfast_org_people_views` ADD CONSTRAINT `org_people_views_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_provider_routine_calls` ADD CONSTRAINT `org_provider_routine_calls_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_signal_views` ADD CONSTRAINT `org_signal_views_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_signals` ADD CONSTRAINT `org_signals_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_entries` ADD CONSTRAINT `org_skill_index_entries_state_slug_uq` UNIQUE(`skill_index_state_id`,`slug`);--> statement-breakpoint
ALTER TABLE `lightfast_org_skill_index_states` ADD CONSTRAINT `org_skill_index_states_source_control_repository_uq` UNIQUE(`source_control_repository_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_repositories` ADD CONSTRAINT `org_source_control_repositories_binding_repository_uq` UNIQUE(`org_source_control_binding_id`,`provider_repository_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_webhook_deliveries` ADD CONSTRAINT `org_source_control_webhook_deliveries_delivery_id_uq` UNIQUE(`delivery_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_context_items` ADD CONSTRAINT `org_workspace_assistant_context_items_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_conversations` ADD CONSTRAINT `org_workspace_assistant_conversations_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_generations` ADD CONSTRAINT `org_workspace_assistant_generations_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_generations` ADD CONSTRAINT `org_workspace_assistant_generations_assistant_message_uq` UNIQUE(`assistant_message_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_messages` ADD CONSTRAINT `org_workspace_assistant_messages_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_messages` ADD CONSTRAINT `org_workspace_assistant_messages_conversation_sequence_uq` UNIQUE(`conversation_id`,`sequence`);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_messages` ADD CONSTRAINT `org_workspace_assistant_messages_conv_idempotency_key_uq` UNIQUE(`conversation_id`,`idempotency_key`);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_tool_calls` ADD CONSTRAINT `org_workspace_assistant_tool_calls_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
ALTER TABLE `lightfast_org_workspace_assistant_tool_calls` ADD CONSTRAINT `org_workspace_assistant_tool_calls_generation_tool_call_uq` UNIQUE(`generation_id`,`tool_call_id`);--> statement-breakpoint
CREATE INDEX `org_automation_runs_automation_created_idx` ON `lightfast_org_automation_runs` (`automation_public_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_automation_runs_org_status_created_idx` ON `lightfast_org_automation_runs` (`clerk_org_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_automations_org_status_next_run_idx` ON `lightfast_org_automations` (`clerk_org_id`,`status`,`next_run_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_automations_due_idx` ON `lightfast_org_automations` (`status`,`next_run_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_identity_index_files_state_status_idx` ON `lightfast_org_identity_index_files` (`identity_index_state_id`,`status`);--> statement-breakpoint
CREATE INDEX `org_identity_index_states_last_checked_idx` ON `lightfast_org_identity_index_states` (`last_checked_at`);--> statement-breakpoint
CREATE INDEX `org_identity_index_states_refresh_locked_until_idx` ON `lightfast_org_identity_index_states` (`refresh_locked_until`);--> statement-breakpoint
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
CREATE INDEX `org_workspace_assistant_tool_calls_org_created_idx` ON `lightfast_org_workspace_assistant_tool_calls` (`clerk_org_id`,`created_at`,`id`);