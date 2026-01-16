import { DEFAULT_HOST, DEFAULT_PORT } from '@minecarta/shared';
import type { ServerConfig } from '../types/index.js';

/**
 * Load server configuration from environment variables
 */
export function loadConfig(): ServerConfig {
    return {
        port: parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10),
        host: process.env.HOST ?? DEFAULT_HOST,
        authToken: process.env.AUTH_TOKEN ?? 'dev-token',
        dataDir: process.env.DATA_DIR ?? './data',
        logLevel: (process.env.LOG_LEVEL as ServerConfig['logLevel']) ?? 'info',
    };
}

/**
 * Global configuration - can be set for testing
 */
let _config: ServerConfig | null = null;

export function setConfig(config: ServerConfig): void {
    _config = config;
}

export function getConfig(): ServerConfig {
    if (!_config) {
        _config = loadConfig();
    }
    return _config;
}

export function resetConfig(): void {
    _config = null;
}
