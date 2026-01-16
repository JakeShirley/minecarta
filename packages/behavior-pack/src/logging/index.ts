/**
 * Centralized logging for the behavior pack.
 *
 * Provides logDebug, logInfo, logWarning, and logError functions
 * that respect a configurable log level.
 */

import { config } from '../config';

import { LogLevel } from './types';

// Re-export types for convenience
export { LOG_LEVEL_MAP, LogLevel } from './types';

// Declare console for Minecraft Script API environment
declare const console: {
    log(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
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
