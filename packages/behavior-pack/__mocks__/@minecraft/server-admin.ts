/**
 * Mock implementation of @minecraft/server-admin for testing.
 * This module is only available in Bedrock Dedicated Server runtime.
 */

/**
 * Mock implementation of SecretString.
 * In the real implementation, this is an opaque placeholder that hides the actual secret value.
 */
export class SecretString {
    constructor(public readonly value: string) {}
}

/**
 * Mock configuration values for testing.
 * Tests can modify these to simulate different configurations.
 */
export const mockConfig: Record<string, unknown> = {
    serverUrl: 'http://localhost:3000',
};

/**
 * Mock secrets values for testing.
 * Tests can modify these to simulate different secrets.
 */
export const mockSecrets: Record<string, SecretString> = {
    authToken: new SecretString('test-token'),
};

/**
 * Reset mock configuration to defaults.
 */
export function resetMockConfig(): void {
    Object.keys(mockConfig).forEach(key => delete mockConfig[key]);
    Object.keys(mockSecrets).forEach(key => delete mockSecrets[key]);
    mockConfig.serverUrl = 'http://localhost:3000';
    mockSecrets.authToken = new SecretString('test-token');
}

/**
 * Mock variables object that returns values from mockConfig.
 */
export const variables = {
    get(key: string): unknown {
        return mockConfig[key];
    },
};

/**
 * Mock secrets object that returns SecretString values from mockSecrets.
 */
export const secrets = {
    get(key: string): SecretString | undefined {
        return mockSecrets[key];
    },
};
