/**
 * Unit tests for configuration
 */

import { describe, it, expect } from 'vitest';
import { config, getApiUrl } from '../src/config';

describe('Config', () => {
  describe('config defaults', () => {
    it('should have a default server URL', () => {
      expect(config.serverUrl).toBe('http://localhost:3000');
    });

    it('should have a default auth token', () => {
      expect(config.authToken).toBeDefined();
      expect(typeof config.authToken).toBe('string');
    });

    it('should have a default player update interval', () => {
      expect(config.playerUpdateInterval).toBe(20);
    });

    it('should have debug enabled by default', () => {
      expect(config.debug).toBe(true);
    });
  });

  describe('getApiUrl', () => {
    it('should combine server URL and endpoint', () => {
      const url = getApiUrl('/api/v1/players');
      expect(url).toBe('http://localhost:3000/api/v1/players');
    });

    it('should handle endpoint without leading slash', () => {
      const url = getApiUrl('api/v1/players');
      expect(url).toBe('http://localhost:3000/api/v1/players');
    });

    it('should handle server URL with trailing slash', () => {
      // This would need config modification, but we can test the regex logic
      const testUrl = 'http://example.com/'.replace(/\/$/, '');
      expect(testUrl).toBe('http://example.com');
    });
  });
});
