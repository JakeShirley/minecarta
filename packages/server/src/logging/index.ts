/**
 * Centralized logging for the server.
 *
 * Provides logDebug, logInfo, logWarning, and logError functions
 * that respect a configurable log level from server config.
 */

import { getConfig } from '../config/index.js';

// ==========================================
// Types
// ==========================================

/**
 * Log level enum. Lower values = more verbose.
 * Only messages at or above the configured level will be logged.
 */
export enum LogLevel {
    /** Trace: Most verbose, includes trace-level debugging */
    Trace = 0,
    /** Debug: Detailed debugging information */
    Debug = 1,
    /** Info: General informational messages */
    Info = 2,
    /** Warn: Warning messages for potentially problematic situations */
    Warn = 3,
    /** Error: Error messages for failures and exceptions */
    Error = 4,
    /** Fatal: Critical errors that may cause the application to exit */
    Fatal = 5,
}

/**
 * Map of log level names to their enum values.
 * Used for parsing config values.
 */
export const LOG_LEVEL_MAP: Readonly<Record<string, LogLevel>> = {
    trace: LogLevel.Trace,
    debug: LogLevel.Debug,
    info: LogLevel.Info,
    warn: LogLevel.Warn,
    warning: LogLevel.Warn,
    error: LogLevel.Error,
    fatal: LogLevel.Fatal,
};

// ==========================================
// Internal Helpers
// ==========================================

/**
 * Get the current log level from config.
 */
function getLogLevel(): LogLevel {
    const config = getConfig();
    return LOG_LEVEL_MAP[config.logLevel] ?? LogLevel.Warn;
}

/**
 * Format data for logging, converting objects to JSON strings.
 */
function formatData(data: unknown): string {
    if (data === undefined) {
        return '';
    }
    if (data instanceof Error) {
        return data.stack ?? data.message;
    }
    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
}

/**
 * Check if a message at the given level should be logged.
 */
function shouldLog(level: LogLevel): boolean {
    return level >= getLogLevel();
}

/**
 * Get timestamp string for log messages.
 */
function getTimestamp(): string {
    return new Date().toISOString();
}

// ==========================================
// Public Logging Functions
// ==========================================

/**
 * Log a debug message. Only logged when logLevel is Debug or lower.
 *
 * @param tag - The component/module tag (e.g., "WebSocket", "TileGenerator")
 * @param message - The message to log
 * @param data - Optional data to include in the log
 */
export function logDebug(tag: string, message: string, data?: unknown): void {
    if (shouldLog(LogLevel.Debug)) {
        if (data !== undefined) {
            console.debug(`${getTimestamp()} [DEBUG] [${tag}] ${message}`, formatData(data));
        } else {
            console.debug(`${getTimestamp()} [DEBUG] [${tag}] ${message}`);
        }
    }
}

/**
 * Log an info message. Logged when logLevel is Info or lower.
 *
 * @param tag - The component/module tag (e.g., "Server", "API")
 * @param message - The message to log
 * @param data - Optional data to include in the log
 */
export function logInfo(tag: string, message: string, data?: unknown): void {
    if (shouldLog(LogLevel.Info)) {
        if (data !== undefined) {
            console.info(`${getTimestamp()} [INFO] [${tag}] ${message}`, formatData(data));
        } else {
            console.info(`${getTimestamp()} [INFO] [${tag}] ${message}`);
        }
    }
}

/**
 * Log a warning message. Logged when logLevel is Warn or lower.
 *
 * @param tag - The component/module tag
 * @param message - The message to log
 * @param data - Optional data to include in the log
 */
export function logWarning(tag: string, message: string, data?: unknown): void {
    if (shouldLog(LogLevel.Warn)) {
        if (data !== undefined) {
            console.warn(`${getTimestamp()} [WARN] [${tag}] ${message}`, formatData(data));
        } else {
            console.warn(`${getTimestamp()} [WARN] [${tag}] ${message}`);
        }
    }
}

/**
 * Log an error message. Logged when logLevel is Error or lower.
 *
 * @param tag - The component/module tag
 * @param message - The message to log
 * @param data - Optional data to include in the log (typically the error object)
 */
export function logError(tag: string, message: string, data?: unknown): void {
    if (shouldLog(LogLevel.Error)) {
        if (data !== undefined) {
            console.error(`${getTimestamp()} [ERROR] [${tag}] ${message}`, formatData(data));
        } else {
            console.error(`${getTimestamp()} [ERROR] [${tag}] ${message}`);
        }
    }
}
