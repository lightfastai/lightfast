import { describe, it, expect, vi } from 'vitest';
import { ChatErrorHandler, ChatErrorType } from '../chat-error-handler';

describe('ChatErrorHandler', () => {
  describe('Error Classification', () => {
    it('should classify rate limit errors (429)', () => {
      const error = new Error('Too many requests');
      (error as any).status = 429;
      
      const result = ChatErrorHandler.handleError(error, { showToast: false });
      
      expect(result.type).toBe(ChatErrorType.RATE_LIMIT);
      expect(result.retryable).toBe(false);
      expect(result.statusCode).toBe(429);
      expect(result.message).toContain('Rate limit');
    });

    it('should classify bot detection errors', () => {
      const error = new Error('Bot detection triggered');
      (error as any).status = 403;
      
      const result = ChatErrorHandler.handleError(error, { showToast: false });
      
      expect(result.type).toBe(ChatErrorType.BOT_DETECTION);
      expect(result.retryable).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it('should classify model access denied errors', () => {
      const error = new Error('This model requires authentication');
      (error as any).status = 403;
      
      const result = ChatErrorHandler.handleError(error, { showToast: false });
      
      expect(result.type).toBe(ChatErrorType.MODEL_ACCESS_DENIED);
      expect(result.retryable).toBe(false);
      expect(result.details).toContain('Sign in');
    });

    it('should classify network errors', () => {
      const error = new Error('Network request failed');
      
      const result = ChatErrorHandler.handleError(error, { showToast: false });
      
      expect(result.type).toBe(ChatErrorType.NETWORK);
      expect(result.retryable).toBe(true);
      expect(result.actionLabel).toBe('Retry');
    });

    it('should classify authentication errors (401)', () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;
      
      const result = ChatErrorHandler.handleError(error, { showToast: false });
      
      expect(result.type).toBe(ChatErrorType.AUTHENTICATION);
      expect(result.retryable).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should classify server errors (500)', () => {
      const error = new Error('Internal server error');
      (error as any).status = 500;
      
      const result = ChatErrorHandler.handleError(error, { showToast: false });
      
      expect(result.type).toBe(ChatErrorType.SERVER_ERROR);
      expect(result.retryable).toBe(true);
      expect(result.statusCode).toBe(500);
    });

    it('should handle unknown errors gracefully', () => {
      const error = { weird: 'object' };
      
      const result = ChatErrorHandler.handleError(error, { showToast: false });
      
      expect(result.type).toBe(ChatErrorType.UNKNOWN);
      expect(result.retryable).toBe(true);
      expect(result.message).toBe('Something went wrong');
    });
  });

  describe('Retry Functionality', () => {
    it('should provide retry callback for retryable errors', () => {
      const error = new Error('Network error');
      const onRetry = vi.fn();
      
      const result = ChatErrorHandler.handleError(error, { 
        showToast: false,
        onRetry 
      });
      
      expect(result.retryable).toBe(true);
      expect(result.action).toBeDefined();
      
      // Execute the retry action
      result.action?.();
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should not provide retry for non-retryable errors', () => {
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;
      const onRetry = vi.fn();
      
      const result = ChatErrorHandler.handleError(error, { 
        showToast: false,
        onRetry 
      });
      
      expect(result.retryable).toBe(false);
      expect(result.action).toBeUndefined();
    });
  });

  describe('Error Messages', () => {
    it('should use custom message when provided', () => {
      const error = new Error('Some error');
      
      const result = ChatErrorHandler.handleError(error, { 
        showToast: false,
        customMessage: 'Custom error message'
      });
      
      expect(result.message).toBe('Custom error message');
    });

    it('should provide helpful details for each error type', () => {
      const testCases = [
        {
          error: Object.assign(new Error('rate'), { status: 429 }),
          expectedDetail: /wait|moment/i
        },
        {
          error: Object.assign(new Error('network'), {}),
          expectedDetail: /connection|internet/i
        },
        {
          error: Object.assign(new Error('auth'), { status: 401 }),
          expectedDetail: /sign in/i
        }
      ];

      testCases.forEach(({ error, expectedDetail }) => {
        const result = ChatErrorHandler.handleError(error, { showToast: false });
        expect(result.details).toMatch(expectedDetail);
      });
    });
  });

  describe('shouldShowInline', () => {
    it('should show inline for critical errors', () => {
      const criticalTypes = [
        ChatErrorType.RATE_LIMIT,
        ChatErrorType.MODEL_ACCESS_DENIED,
        ChatErrorType.BOT_DETECTION,
        ChatErrorType.AUTHENTICATION,
      ];

      criticalTypes.forEach(type => {
        const error = { type, message: 'Test', retryable: false };
        expect(ChatErrorHandler.shouldShowInline(error)).toBe(true);
      });
    });

    it('should not show inline for transient errors', () => {
      const transientTypes = [
        ChatErrorType.NETWORK,
        ChatErrorType.TIMEOUT,
        ChatErrorType.SERVER_ERROR,
      ];

      transientTypes.forEach(type => {
        const error = { type, message: 'Test', retryable: true };
        expect(ChatErrorHandler.shouldShowInline(error)).toBe(false);
      });
    });
  });

  describe('AI SDK Error Handling', () => {
    it('should handle AI SDK error format', () => {
      const error = new Error('API call failed');
      (error as any).name = 'APICallError';
      (error as any).statusCode = 503;
      
      const result = ChatErrorHandler.handleError(error, { showToast: false });
      
      expect(result.type).toBe(ChatErrorType.NETWORK);
      expect(result.statusCode).toBe(503);
    });

    it('should extract nested status codes', () => {
      const error = new Error('Request failed');
      (error as any).cause = { status: 429 };
      
      const result = ChatErrorHandler.handleError(error, { showToast: false });
      
      expect(result.statusCode).toBe(429);
      expect(result.type).toBe(ChatErrorType.RATE_LIMIT);
    });
  });
});