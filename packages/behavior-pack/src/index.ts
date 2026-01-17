/**
 * World Map Sync - Minecraft Behavior Pack
 *
 * This behavior pack monitors world events and sends data to an external
 * map server for real-time visualization.
 */

import { system } from '@minecraft/server';
import {
    registerAllEventListeners,
    updatePlayerPositions,
    syncWorldSpawn,
    syncWorldTime,
    checkWorldTimeChange,
} from './events';
import { registerCustomCommands } from './commands';
import { connectToServer } from './network';
import { config } from './config';
import { startQueueProcessor, resortQueue } from './chunk-queue';
import { logInfo, logWarning, logError, LogLevel, logDebug } from './logging';

// Register custom commands during startup (must be done in early-execution mode)
registerCustomCommands();

/**
 * Logging tag for the main module
 */
const LOG_TAG = 'MapSync';

/**
 * Get human-readable log level name
 */
function getLogLevelName(level: LogLevel): string {
    switch (level) {
        case LogLevel.Debug:
            return 'Debug';
        case LogLevel.Info:
            return 'Info';
        case LogLevel.Warning:
            return 'Warning';
        case LogLevel.Error:
            return 'Error';
        case LogLevel.None:
            return 'None';
        default:
            return 'Unknown';
    }
}

/**
 * Initialize the behavior pack
 */
async function initialize(): Promise<void> {
    logInfo(LOG_TAG, 'World Map Sync initializing...');
    logInfo(LOG_TAG, `Server URL: ${config.serverUrl}`);
    logInfo(LOG_TAG, `Log level: ${getLogLevelName(config.logLevel)}`);

    // Connect to the server (with version check)
    const connected = await connectToServer();
    if (connected) {
        logInfo(LOG_TAG, 'Successfully connected to map server!');

        // Sync the world spawn location on boot
        await syncWorldSpawn();

        // Sync the initial world time
        await syncWorldTime(true);
    } else {
        logWarning(LOG_TAG, 'Could not connect to map server. Will retry on events.');
    }

    // Register event listeners
    registerAllEventListeners();

    // Start the chunk generation queue processor
    startQueueProcessor();
    logDebug(LOG_TAG, 'Chunk generation queue processor started');

    // Set up periodic player position updates
    system.runInterval(() => {
        updatePlayerPositions();
        // Also check for time changes each player update
        checkWorldTimeChange();
        // Periodically resort the queue based on player positions
        resortQueue();
    }, config.playerUpdateInterval);

    // Set up periodic world time sync (less frequent, about once per minute)
    system.runInterval(() => {
        syncWorldTime(true);
    }, config.timeSyncInterval);

    logInfo(LOG_TAG, 'Initialization complete!');
}

/**
 * Wait for world to be ready before initializing
 */
system.runTimeout(() => {
    initialize().catch(error => {
        logError(LOG_TAG, 'Initialization failed', error);
    });
}, 20); // Wait 1 second (20 ticks) for world to stabilize

// Export for testing
export { initialize };
