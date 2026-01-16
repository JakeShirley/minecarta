/**
 * Custom command registration for map sync operations
 */

import { system, world, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from '@minecraft/server';
import type { CustomCommandOrigin, CustomCommandResult, Player, Dimension } from '@minecraft/server';
import { serializeChunkData } from '../serializers';
import { sendChunkData } from '../network';
import { config } from '../config';
import { scanChunk } from '../blocks';

/**
 * State for auto-generation mode per player
 */
interface AutoGenState {
    readonly radiusBlocks: number;
    readonly intervalTicks: number;
    runId: number | null;
}

/**
 * Map of player names to their auto-generation state
 */
const autoGenPlayers: Map<string, AutoGenState> = new Map();

/**
 * Log debug messages
 */
function logDebug(message: string, data?: unknown): void {
    if (config.debug) {
        console.log(`[MapSync Commands] ${message}`, data ? JSON.stringify(data) : '');
    }
}

/**
 * Scan and send tiles around a player's current position
 *
 * @param player - The player to scan around
 * @param radiusBlocks - Radius in blocks around the player
 */
async function scanAroundPlayer(player: Player, radiusBlocks: number): Promise<void> {
    try {
        const location = player.location;
        const dimension = player.dimension;

        // Calculate how many chunks to scan based on block radius
        const chunkRadius = Math.ceil(radiusBlocks / 16);
        const centerChunkX = Math.floor(location.x / 16);
        const centerChunkZ = Math.floor(location.z / 16);

        const chunkDataBatch: ReturnType<typeof serializeChunkData>[] = [];

        for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
            for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
                const chunkX = centerChunkX + dx;
                const chunkZ = centerChunkZ + dz;

                try {
                    const chunkData = scanChunk(dimension, chunkX, chunkZ);
                    const serialized = serializeChunkData(chunkData);
                    chunkDataBatch.push(serialized);

                    // Send in batches of 10 chunks
                    if (chunkDataBatch.length >= 10) {
                        await sendChunkData(chunkDataBatch);
                        chunkDataBatch.length = 0;
                    }
                } catch (error) {
                    logDebug(`Failed to scan chunk (${chunkX}, ${chunkZ})`, error);
                }
            }
        }

        // Send remaining chunks
        if (chunkDataBatch.length > 0) {
            await sendChunkData(chunkDataBatch);
        }

        logDebug(`Auto-gen scan complete for ${player.name}`, {
            location: { x: location.x, z: location.z },
            chunkRadius,
        });
    } catch (error) {
        logDebug(`Auto-gen scan failed for ${player.name}`, error);
    }
}

/**
 * Start auto-generation for a player
 *
 * @param player - The player to start auto-generation for
 * @param radiusBlocks - Radius in blocks around the player
 * @param intervalSeconds - Interval in seconds between scans
 */
function startAutoGen(player: Player, radiusBlocks: number, intervalSeconds: number): void {
    const playerName = player.name;

    // Stop existing auto-gen if running
    stopAutoGen(playerName);

    const intervalTicks = intervalSeconds * 20; // Convert seconds to ticks

    const runId = system.runInterval(() => {
        // Find the player (they may have moved or disconnected)
        const currentPlayer = world.getAllPlayers().find(p => p.name === playerName);
        if (!currentPlayer) {
            // Player disconnected, stop auto-gen
            stopAutoGen(playerName);
            return;
        }

        scanAroundPlayer(currentPlayer, radiusBlocks).catch(error => {
            logDebug(`Auto-gen error for ${playerName}`, error);
        });
    }, intervalTicks);

    autoGenPlayers.set(playerName, {
        radiusBlocks,
        intervalTicks,
        runId,
    });

    console.log(
        `[MapSync] Auto-gen started for ${playerName}: radius=${radiusBlocks} blocks, interval=${intervalSeconds}s`
    );
}

/**
 * Stop auto-generation for a player
 *
 * @param playerName - The name of the player to stop auto-generation for
 * @returns True if auto-gen was stopped, false if it wasn't running
 */
function stopAutoGen(playerName: string): boolean {
    const state = autoGenPlayers.get(playerName);
    if (state?.runId !== null && state?.runId !== undefined) {
        system.clearRun(state.runId);
        autoGenPlayers.delete(playerName);
        console.log(`[MapSync] Auto-gen stopped for ${playerName}`);
        return true;
    }
    return false;
}

/**
 * Check if auto-generation is active for a player
 *
 * @param playerName - The name of the player to check
 * @returns The auto-gen state if active, undefined otherwise
 */
function getAutoGenState(playerName: string): AutoGenState | undefined {
    return autoGenPlayers.get(playerName);
}

/**
 * Maximum chunks per ticking area to stay well under the 300 chunk limit
 * Using 10x10 = 100 chunks per area for safety margin
 */
const TICKING_AREA_CHUNK_SIZE = 10;

/**
 * Tracking state for scan jobs
 */
interface ScanJobState {
    chunksScanned: number;
    blocksSent: number;
    chunkDataBatch: ReturnType<typeof serializeChunkData>[];
}

/**
 * Generator function to scan a section of chunks
 * Yields after each chunk to spread work across ticks
 */
function* scanSectionGenerator(
    dimension: Dimension,
    sectionStartX: number,
    sectionStartZ: number,
    sectionEndX: number,
    sectionEndZ: number,
    state: ScanJobState
): Generator<void, void, void> {
    for (let chunkX = sectionStartX; chunkX <= sectionEndX; chunkX++) {
        for (let chunkZ = sectionStartZ; chunkZ <= sectionEndZ; chunkZ++) {
            try {
                const chunkData = scanChunk(dimension, chunkX, chunkZ);
                state.chunksScanned++;
                state.blocksSent += chunkData.blocks.length;

                const serialized = serializeChunkData(chunkData);
                state.chunkDataBatch.push(serialized);

                // Send in batches of 10 chunks to avoid overwhelming the server
                if (state.chunkDataBatch.length >= 10) {
                    sendChunkData(state.chunkDataBatch).catch(error => {
                        logDebug('Failed to send chunk data batch', error);
                    });
                    state.chunkDataBatch.length = 0;
                }
            } catch (error) {
                logDebug(`Failed to scan chunk (${chunkX}, ${chunkZ})`, error);
            }
            // Yield after each chunk to spread work across ticks
            yield;
        }
    }
}

/**
 * Force scan a block range and submit all chunk tiles to the server
 * Uses system.runJob with generators to spread work across server ticks
 *
 * @param dimension - The dimension to scan
 * @param minX - Minimum X coordinate (world coords)
 * @param minZ - Minimum Z coordinate (world coords)
 * @param maxX - Maximum X coordinate (world coords)
 * @param maxZ - Maximum Z coordinate (world coords)
 * @param forceLoad - Whether to force load chunks using ticking areas
 */
function forceScanRange(
    dimension: Dimension,
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    forceLoad: boolean = false
): void {
    // Calculate chunk boundaries
    const minChunkX = Math.floor(minX / 16);
    const minChunkZ = Math.floor(minZ / 16);
    const maxChunkX = Math.floor(maxX / 16);
    const maxChunkZ = Math.floor(maxZ / 16);

    const totalChunksX = maxChunkX - minChunkX + 1;
    const totalChunksZ = maxChunkZ - minChunkZ + 1;
    const totalChunks = totalChunksX * totalChunksZ;

    console.log(
        `[MapSync] Force scanning ${totalChunks} chunks from (${minChunkX}, ${minChunkZ}) to (${maxChunkX}, ${maxChunkZ})${forceLoad ? ' with force loading' : ''}`
    );

    // Create state object to track progress across generator yields
    const state: ScanJobState = {
        chunksScanned: 0,
        blocksSent: 0,
        chunkDataBatch: [],
    };

    // Build list of sections to process
    const sections: Array<{
        startX: number;
        startZ: number;
        endX: number;
        endZ: number;
    }> = [];

    for (let sectionStartX = minChunkX; sectionStartX <= maxChunkX; sectionStartX += TICKING_AREA_CHUNK_SIZE) {
        for (let sectionStartZ = minChunkZ; sectionStartZ <= maxChunkZ; sectionStartZ += TICKING_AREA_CHUNK_SIZE) {
            sections.push({
                startX: sectionStartX,
                startZ: sectionStartZ,
                endX: Math.min(sectionStartX + TICKING_AREA_CHUNK_SIZE - 1, maxChunkX),
                endZ: Math.min(sectionStartZ + TICKING_AREA_CHUNK_SIZE - 1, maxChunkZ),
            });
        }
    }

    // Process sections sequentially, handling ticking areas for force load
    let currentSectionIndex = 0;
    let currentTickingAreaId: string | null = null;

    /**
     * Generator that processes all sections
     */
    function* mainScanGenerator(): Generator<void, void, void> {
        while (currentSectionIndex < sections.length) {
            const section = sections[currentSectionIndex];
            const tickingAreaId = `mapsync_scan_${Date.now()}_${section.startX}_${section.startZ}`;

            // If force loading, create ticking area for this section
            if (forceLoad) {
                const tickingAreaOptions = {
                    dimension,
                    from: { x: section.startX * 16, y: 0, z: section.startZ * 16 },
                    to: { x: (section.endX + 1) * 16 - 1, y: 0, z: (section.endZ + 1) * 16 - 1 },
                };

                logDebug(
                    `Creating ticking area for section (${section.startX}, ${section.startZ}) to (${section.endX}, ${section.endZ})`
                );

                currentTickingAreaId = tickingAreaId;

                // Create ticking area and wait for it to load
                // We use a promise-based approach with runJob continuation
                world.tickingAreaManager
                    .createTickingArea(tickingAreaId, tickingAreaOptions)
                    .then(() => {
                        // Once loaded, run the section scan job
                        system.runJob(sectionScanGenerator(section));
                    })
                    .catch(error => {
                        logDebug(`Failed to create ticking area: ${error}`);
                        // Move to next section even on failure
                        currentSectionIndex++;
                        system.runJob(mainScanGenerator());
                    });

                // Exit this generator - continuation happens in promise callbacks
                return;
            } else {
                // No force loading - scan section directly
                yield* scanSectionGenerator(
                    dimension,
                    section.startX,
                    section.startZ,
                    section.endX,
                    section.endZ,
                    state
                );
                currentSectionIndex++;
            }
        }

        // All sections done - send remaining data and log completion
        if (state.chunkDataBatch.length > 0) {
            sendChunkData(state.chunkDataBatch).catch(error => {
                logDebug('Failed to send final chunk data batch', error);
            });
        }

        console.log(
            `[MapSync] Force scan complete: ${state.chunksScanned} chunks scanned, ${state.blocksSent} blocks sent`
        );
    }

    /**
     * Generator to scan a section and then clean up/continue to next
     */
    function* sectionScanGenerator(section: (typeof sections)[0]): Generator<void, void, void> {
        // Scan the section
        yield* scanSectionGenerator(dimension, section.startX, section.startZ, section.endX, section.endZ, state);

        // Clean up ticking area
        if (currentTickingAreaId) {
            try {
                world.tickingAreaManager.removeTickingArea(currentTickingAreaId);
                logDebug(`Removed ticking area ${currentTickingAreaId}`);
            } catch (error) {
                logDebug(`Failed to remove ticking area ${currentTickingAreaId}`, error);
            }
            currentTickingAreaId = null;
        }

        // Move to next section and continue
        currentSectionIndex++;

        if (currentSectionIndex < sections.length) {
            // Continue with next section
            system.runJob(mainScanGenerator());
        } else {
            // All done - send remaining data
            if (state.chunkDataBatch.length > 0) {
                sendChunkData(state.chunkDataBatch).catch(error => {
                    logDebug('Failed to send final chunk data batch', error);
                });
            }

            console.log(
                `[MapSync] Force scan complete: ${state.chunksScanned} chunks scanned, ${state.blocksSent} blocks sent`
            );
        }
    }

    // Start the scan job
    system.runJob(mainScanGenerator());
}

/**
 * Register all custom commands
 */
export function registerCustomCommands(): void {
    system.beforeEvents.startup.subscribe(event => {
        const registry = event.customCommandRegistry;

        // Register the mapsync:scan command
        registry.registerCommand(
            {
                name: 'mapsync:scan',
                description: 'Force scan a block range and submit tiles to the map server',
                permissionLevel: CommandPermissionLevel.GameDirectors,
                mandatoryParameters: [
                    { name: 'min', type: CustomCommandParamType.Location },
                    { name: 'max', type: CustomCommandParamType.Location },
                ],
                optionalParameters: [{ name: 'forceLoad', type: CustomCommandParamType.Boolean }],
            },
            (
                origin: CustomCommandOrigin,
                min: { x: number; y: number; z: number },
                max: { x: number; y: number; z: number },
                forceLoad?: boolean
            ): CustomCommandResult => {
                // Command must be run by a player or entity with a dimension
                const dimension = origin.sourceEntity?.dimension;
                if (!dimension) {
                    return {
                        status: CustomCommandStatus.Failure,
                        message: 'This command must be run from a dimension context (e.g., by a player)',
                    };
                }

                const shouldForceLoad = forceLoad ?? false;

                console.log(
                    `[MapSync] Scan command received: (${min.x}, ${min.z}) to (${max.x}, ${max.z}) in ${dimension.id}${shouldForceLoad ? ' with force loading' : ''}`
                );

                // Start the force scan job using runJob with generators
                forceScanRange(dimension, min.x, min.z, max.x, max.z, shouldForceLoad);

                return {
                    status: CustomCommandStatus.Success,
                    message: `Starting force scan from (${min.x}, ${min.z}) to (${max.x}, ${max.z}) in ${dimension.id}${shouldForceLoad ? ' with force loading' : ''}`,
                };
            }
        );

        // Register the mapsync:autogen command
        registry.registerCommand(
            {
                name: 'mapsync:autogen',
                description: 'Toggle automatic tile generation around the player',
                permissionLevel: CommandPermissionLevel.GameDirectors,
                optionalParameters: [
                    { name: 'radius', type: CustomCommandParamType.Integer },
                    { name: 'interval', type: CustomCommandParamType.Integer },
                ],
            },
            (origin: CustomCommandOrigin, radiusBlocks?: number, intervalSeconds?: number): CustomCommandResult => {
                const player = origin.sourceEntity;

                // Command must be run by a player
                if (!player || !('name' in player)) {
                    return {
                        status: CustomCommandStatus.Failure,
                        message: 'This command must be run by a player',
                    };
                }

                const playerName = (player as Player).name;
                const currentState = getAutoGenState(playerName);

                // If no parameters provided, toggle off or show status
                if (radiusBlocks === undefined && intervalSeconds === undefined) {
                    if (currentState) {
                        stopAutoGen(playerName);
                        return {
                            status: CustomCommandStatus.Success,
                            message: 'Auto-generation disabled',
                        };
                    } else {
                        return {
                            status: CustomCommandStatus.Success,
                            message:
                                'Auto-generation is not active. Use: /mapsync:autogen <radius> <interval> to enable',
                        };
                    }
                }

                // Validate parameters
                const radius = radiusBlocks ?? 64; // Default 64 blocks (4 chunks)
                const interval = intervalSeconds ?? 10; // Default 10 seconds

                if (radius < 16 || radius > 256) {
                    return {
                        status: CustomCommandStatus.Failure,
                        message: 'Radius must be between 16 and 256 blocks',
                    };
                }

                if (interval < 1 || interval > 300) {
                    return {
                        status: CustomCommandStatus.Failure,
                        message: 'Interval must be between 1 and 300 seconds',
                    };
                }

                // Start auto-generation
                system.run(() => {
                    const currentPlayer = world.getAllPlayers().find(p => p.name === playerName);
                    if (currentPlayer) {
                        startAutoGen(currentPlayer, radius, interval);
                    }
                });

                return {
                    status: CustomCommandStatus.Success,
                    message: `Auto-generation enabled: radius=${radius} blocks, interval=${interval}s`,
                };
            }
        );

        console.log('[MapSync] Custom commands registered');
    });
}

