/**
 * Log level types for the behavior pack logging system.
 * Separated to avoid circular dependencies with config.
 */

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
