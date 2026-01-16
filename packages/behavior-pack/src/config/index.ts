import { variables, secrets, SecretString } from '@minecraft/server-admin';

import { LOG_LEVEL_MAP, LogLevel } from '../logging/types';

/**
 * Configuration for the behavior pack
 */
export interface Config {
    /** Base URL of the map server */
    readonly serverUrl: string;
    /**
     * Authentication token for server communication.
     * This is a SecretString that can be used directly with HttpHeader.
     */
    readonly authToken: SecretString;
    /** Interval in ticks between player position updates (20 ticks = 1 second) */
    readonly playerUpdateInterval: number;
    /**
     * Interval in ticks between world time sync updates.
     * Default: 1200 ticks = 60 seconds (1 minute).
     * Time is also synced when a significant change is detected (e.g., /time set command).
     */
    readonly timeSyncInterval: number;
    /**
     * Log level for the behavior pack.
     * Controls which log messages are displayed.
     * Default: Warning (only warnings and errors are logged)
     */
    readonly logLevel: LogLevel;
    /**
     * Whether to send player stats (health, hunger, armor) with position updates.
     * Set to true to enable displaying player vitals on the web map.
     * Default: false (for privacy/performance reasons)
     */
    readonly sendPlayerStats: boolean;
}

/**
 * Default configuration values for optional settings
 */
const defaultConfig = {
    playerUpdateInterval: 20, // 1 second
    timeSyncInterval: 1200, // 60 seconds (1 minute)
    logLevel: LogLevel.Warning, // Default to warning level
    sendPlayerStats: true, // Enable player stats by default for development
};

/**
 * Error thrown when required configuration is missing.
 */
export class ConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

/**
 * Attempts to get a string value from server-admin variables.
 * Returns the default value if the variable is not set or is not a string.
 *
 * @param key - The variable key to retrieve
 * @param defaultValue - The default value to return if the variable is not set
 * @returns The variable value or the default value
 */
function getVariable(key: string, defaultValue: string): string {
    try {
        const value = variables.get(key);
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    } catch {
        // Variable not available or server-admin not supported
    }
    return defaultValue;
}

/**
 * Gets a required string value from server-admin variables.
 * Throws ConfigurationError if the variable is not set.
 *
 * @param key - The variable key to retrieve
 * @returns The variable value
 * @throws {ConfigurationError} When the variable is not set
 */
function getRequiredVariable(key: string): string {
    try {
        const value = variables.get(key);
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    } catch {
        // Variable not available or server-admin not supported
    }
    throw new ConfigurationError(
        `Required configuration variable '${key}' is not set. ` +
            `Please configure it in your BDS config/<pack-uuid>/variables.json file.`
    );
}

/**
 * Attempts to get a number value from server-admin variables.
 * Returns the default value if the variable is not set or is not a valid number.
 *
 * @param key - The variable key to retrieve
 * @param defaultValue - The default value to return if the variable is not set
 * @returns The variable value or the default value
 */
function getVariableNumber(key: string, defaultValue: number): number {
    try {
        const value = variables.get(key);
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
    } catch {
        // Variable not available or server-admin not supported
    }
    return defaultValue;
}

/**
 * Attempts to get a boolean value from server-admin variables.
 * Returns the default value if the variable is not set or is not a valid boolean.
 *
 * @param key - The variable key to retrieve
 * @param defaultValue - The default value to return if the variable is not set
 * @returns The variable value or the default value
 */
function getVariableBoolean(key: string, defaultValue: boolean): boolean {
    try {
        const value = variables.get(key);
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === '1') {
                return true;
            }
            if (lower === 'false' || lower === '0') {
                return false;
            }
        }
    } catch {
        // Variable not available or server-admin not supported
    }
    return defaultValue;
}

/**
 * Gets a required secret value from server-admin secrets.
 * Throws ConfigurationError if the secret is not set.
 *
 * @param key - The secret key to retrieve
 * @returns The secret value as a SecretString
 * @throws {ConfigurationError} When the secret is not set
 */
function getRequiredSecret(key: string): SecretString {
    try {
        const value = secrets.get(key);
        if (value !== undefined) {
            return value;
        }
    } catch {
        // Secret not available or server-admin not supported
    }
    throw new ConfigurationError(
        `Required configuration secret '${key}' is not set. ` +
            `Please configure it in your BDS config/<pack-uuid>/secrets.json file.`
    );
}

/**
 * Parses a log level string into a LogLevel enum value.
 *
 * @param value - The log level string to parse
 * @param defaultLevel - The default log level to return if parsing fails
 * @returns The parsed LogLevel or the default value
 */
function parseLogLevel(value: string | undefined, defaultLevel: LogLevel): LogLevel {
    if (!value) {
        return defaultLevel;
    }
    const level = LOG_LEVEL_MAP[value.toLowerCase()];
    return level !== undefined ? level : defaultLevel;
}

/**
 * Loads configuration from server-admin variables and secrets.
 * Falls back to default values for optional settings.
 *
 * Required Variables (configured in variables.json):
 * - serverUrl: Base URL of the map server (REQUIRED)
 *
 * Required Secrets (configured in secrets.json):
 * - authToken: Authentication token for server communication (REQUIRED)
 *
 * Optional Variables:
 * - playerUpdateInterval: Interval in ticks between player position updates
 * - timeSyncInterval: Interval in ticks between world time sync updates
 * - logLevel: Log level (debug, info, warning, error, none)
 * - sendPlayerStats: Whether to send player stats with position updates
 *
 * @returns The loaded configuration
 * @throws {ConfigurationError} When required configuration is missing
 */
function loadConfig(): Config {
    const logLevelStr = getVariable('logLevel', '');
    const logLevel = parseLogLevel(logLevelStr, defaultConfig.logLevel);

    return {
        serverUrl: getRequiredVariable('serverUrl'),
        authToken: getRequiredSecret('authToken'),
        playerUpdateInterval: getVariableNumber('playerUpdateInterval', defaultConfig.playerUpdateInterval),
        timeSyncInterval: getVariableNumber('timeSyncInterval', defaultConfig.timeSyncInterval),
        logLevel,
        sendPlayerStats: getVariableBoolean('sendPlayerStats', defaultConfig.sendPlayerStats),
    };
}

/**
 * Configuration loaded from server-admin variables and secrets,
 * with fallback to default values.
 */
export const config: Config = loadConfig();

/**
 * Get the full API URL for an endpoint
 *
 * @param endpoint - The API endpoint path (e.g., '/api/v1/players')
 * @returns Full URL to the endpoint
 */
export function getApiUrl(endpoint: string): string {
    const base = config.serverUrl.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
}
