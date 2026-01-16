/**
 * Centralized logging for the behavior pack.
 *
 * Provides logDebug, logInfo, logWarning, and logError functions
 * that respect a configurable log level.
 */

import { config } from '../config';

// Declare console for Minecraft Script API environment
declare const console: {
    log(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
};

// ==========================================
// Types
// ==========================================

/**
 * Log level enum. Lower values = more verbose.
 * Only messages at or above the configured level will be logged.
 */
export enum LogLevel {
    /** Debug: Most verbose, includes detailed debugging information */
    Debug = 0,
    /** Info: General informational messages */
    Info = 1,
    /** Warning: Warning messages for potentially problematic situations */
    Warning = 2,
    /** Error: Error messages for failures and exceptions */
    Error = 3,
    /** None: No logging at all */
    None = 4,
}

/**
 * Map of log level names to their enum values.
 * Used for parsing config values.
 */
export const LOG_LEVEL_MAP: Readonly<Record<string, LogLevel>> = {
    debug: LogLevel.Debug,
    info: LogLevel.Info,
    warning: LogLevel.Warning,
    warn: LogLevel.Warning,
    error: LogLevel.Error,
    none: LogLevel.None,
};

// ==========================================
// Internal Helpers
// ==========================================

/**
 * Format data for logging, converting objects to JSON strings.
 */
function formatData(data: unknown): string {
    if (data === undefined) {
        return '';
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
    return level >= config.logLevel;
}

// ==========================================
// Public Logging Functions
// ==========================================

/**
 * Log a debug message. Only logged when logLevel is Debug.
 *
 * @param tag - The component/module tag (e.g., "ChunkQueue", "Network")
 * @param message - The message to log
 * @param data - Optional data to include in the log
 */
export function logDebug(tag: string, message: string, data?: unknown): void {
    if (shouldLog(LogLevel.Debug)) {
        if (data !== undefined) {
            console.log(`[${tag}] ${message}`, formatData(data));
        } else {
            console.log(`[${tag}] ${message}`);
        }
    }
}

/**
 * Log an info message. Logged when logLevel is Info or lower.
 *
 * @param tag - The component/module tag (e.g., "MapSync", "Events")
 * @param message - The message to log
 * @param data - Optional data to include in the log
 */
export function logInfo(tag: string, message: string, data?: unknown): void {
    if (shouldLog(LogLevel.Info)) {
        if (data !== undefined) {
            console.log(`[${tag}] ${message}`, formatData(data));
        } else {
            console.log(`[${tag}] ${message}`);
        }
    }
}

/**
 * Log a warning message. Logged when logLevel is Warning or lower.
 *
 * @param tag - The component/module tag
 * @param message - The message to log
 * @param data - Optional data to include in the log
 */
export function logWarning(tag: string, message: string, data?: unknown): void {
    if (shouldLog(LogLevel.Warning)) {
        if (data !== undefined) {
            console.warn(`[${tag}] ${message}`, formatData(data));
        } else {
            console.warn(`[${tag}] ${message}`);
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
            console.error(`[${tag}] ${message}`, formatData(data));
        } else {
            console.error(`[${tag}] ${message}`);
        }
    }
}
