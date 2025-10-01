/**
 * Validation types for the chat application
 *
 * This module provides types for client-side validation errors
 */

/**
 * Prompt validation error codes
 */
export type PromptErrorCode =
  | "max_files"
  | "max_file_size"
  | "accept"
  | "upload_failed";

/**
 * Prompt validation error structure
 */
export interface PromptError {
  code: PromptErrorCode;
  message: string;
}
