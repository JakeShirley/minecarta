/**
 * World Map Sync - Minecraft Behavior Pack
 *
 * This behavior pack monitors world events and sends data to an external
 * map server for real-time visualization.
 */

import { system, world } from '@minecraft/server';
import {
    registerAllEventListeners,
    updatePlayerPositions,
    syncWorldSpawn,
    syncWorldTime,
    checkWorldTimeChange,
} from './events';
import { registerCustomCommands } from './commands';
import { testConnection } from './network';
import { config } from './config';
import { startQueueProcessor, resortQueue } from './chunk-queue';

// Register custom commands during startup (must be done in early-execution mode)
registerCustomCommands();

/**
 * Log a startup message
 */
function logStartup(message: string): void {
    console.log(`[MapSync] ${message}`);
}

/**
 * Initialize the behavior pack
 */
async function initialize(): Promise<void> {
    logStartup('World Map Sync initializing...');
    logStartup(`Server URL: ${config.serverUrl}`);
    logStartup(`Debug mode: ${config.debug}`);

    // Test connection to the server
    const connected = await testConnection();
    if (connected) {
        logStartup('Successfully connected to map server!');

        // Sync the world spawn location on boot
        await syncWorldSpawn();

        // Sync the initial world time
        await syncWorldTime(true);
    } else {
        logStartup('Warning: Could not connect to map server. Will retry on events.');
    }

    // Register event listeners
    registerAllEventListeners();

    // Start the chunk generation queue processor
    startQueueProcessor();
    logStartup('Chunk generation queue processor started');

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

    logStartup('Initialization complete!');
}

/**
 * Wait for world to be ready before initializing
 */
system.runTimeout(() => {
    initialize().catch(error => {
        console.error('[MapSync] Initialization failed:', error);
    });
}, 20); // Wait 1 second (20 ticks) for world to stabilize

// Export for testing
export { initialize };
