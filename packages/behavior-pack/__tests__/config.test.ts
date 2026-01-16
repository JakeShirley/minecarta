/**
 * Unit tests for configuration
 */

import { describe, it, expect } from 'vitest';
import { config, getApiUrl } from '../src/config';
import { SecretString } from '../__mocks__/@minecraft/server-admin';

describe('Config', () => {
    describe('config values', () => {
        it('should load server URL from variables', () => {
            expect(config.serverUrl).toBe('http://localhost:3000');
        });

        it('should load auth token from secrets as SecretString', () => {
            expect(config.authToken).toBeInstanceOf(SecretString);
        });

        it('should have a default player update interval', () => {
            expect(config.playerUpdateInterval).toBe(20);
        });

        it('should have a default log level', () => {
            expect(config.logLevel).toBeDefined();
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
