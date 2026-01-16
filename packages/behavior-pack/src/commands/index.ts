/**
 * Custom command registration for map sync operations
 */

import { system, world, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from '@minecraft/server';
import type { CustomCommandOrigin, CustomCommandResult, Player, Dimension } from '@minecraft/server';
import { config } from '../config';
import { toDimension } from '../blocks';
import { queueChunks, ChunkJobPriority, getQueueStats, resortQueue, clearQueue } from '../chunk-queue';

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

        const chunksToQueue: Array<{ chunkX: number; chunkZ: number }> = [];

        for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
            for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
                const chunkX = centerChunkX + dx;
                const chunkZ = centerChunkZ + dz;
                chunksToQueue.push({ chunkX, chunkZ });
            }
        }

        // Queue all chunks with low priority (auto-gen background work)
        const dimensionType = toDimension(dimension.id);
        queueChunks(dimensionType, chunksToQueue, {
            priority: ChunkJobPriority.Low,
            sourcePlayer: player.name,
        });

        logDebug(`Auto-gen queued ${chunksToQueue.length} chunks for ${player.name}`, {
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
 * Force scan a block range and queue all chunks for generation.
 * Chunks are sorted by distance from the origin point (spiraling outward).
 * The queue processor handles batching and rate limiting.
 *
 * @param dimension - The dimension to scan
 * @param minX - Minimum X coordinate (world coords)
 * @param minZ - Minimum Z coordinate (world coords)
 * @param maxX - Maximum X coordinate (world coords)
 * @param maxZ - Maximum Z coordinate (world coords)
 * @param originX - Origin X coordinate for distance sorting (world coords)
 * @param originZ - Origin Z coordinate for distance sorting (world coords)
 */
function forceScanRange(
    dimension: Dimension,
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    originX: number,
    originZ: number
): void {
    // Calculate chunk boundaries
    const minChunkX = Math.floor(minX / 16);
    const minChunkZ = Math.floor(minZ / 16);
    const maxChunkX = Math.floor(maxX / 16);
    const maxChunkZ = Math.floor(maxZ / 16);

    // Origin chunk for distance calculations
    const originChunkX = Math.floor(originX / 16);
    const originChunkZ = Math.floor(originZ / 16);

    const totalChunksX = maxChunkX - minChunkX + 1;
    const totalChunksZ = maxChunkZ - minChunkZ + 1;
    const totalChunks = totalChunksX * totalChunksZ;

    console.log(
        `[MapSync] Queueing ${totalChunks} chunks for scan from (${minChunkX}, ${minChunkZ}) to (${maxChunkX}, ${maxChunkZ}), spiraling from (${originChunkX}, ${originChunkZ})`
    );

    // Build list of chunks to queue
    const chunksToQueue: Array<{ chunkX: number; chunkZ: number; distance: number }> = [];

    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
        for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ++) {
            // Calculate squared distance from origin (no need for sqrt for sorting)
            const dx = chunkX - originChunkX;
            const dz = chunkZ - originChunkZ;
            const distance = dx * dx + dz * dz;
            chunksToQueue.push({ chunkX, chunkZ, distance });
        }
    }

    // Sort by distance (closest first) to create spiral effect
    chunksToQueue.sort((a, b) => a.distance - b.distance);

    // Queue all chunks with normal priority (already sorted by distance)
    const dimensionType = toDimension(dimension.id);
    queueChunks(
        dimensionType,
        chunksToQueue.map(c => ({ chunkX: c.chunkX, chunkZ: c.chunkZ })),
        {
            priority: ChunkJobPriority.Normal,
        }
    );

    console.log(`[MapSync] Queued ${totalChunks} chunks. Current queue stats:`, getQueueStats());
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
                description: 'Queue a block range for tile generation',
                permissionLevel: CommandPermissionLevel.GameDirectors,
                mandatoryParameters: [
                    { name: 'min', type: CustomCommandParamType.Location },
                    { name: 'max', type: CustomCommandParamType.Location },
                ],
            },
            (
                origin: CustomCommandOrigin,
                min: { x: number; y: number; z: number },
                max: { x: number; y: number; z: number }
            ): CustomCommandResult => {
                // Command must be run by a player or entity with a dimension
                const sourceEntity = origin.sourceEntity;
                const dimension = sourceEntity?.dimension;
                if (!dimension || !sourceEntity) {
                    return {
                        status: CustomCommandStatus.Failure,
                        message: 'This command must be run from a dimension context (e.g., by a player)',
                    };
                }

                // Get player position for spiral sorting (chunks near player are processed first)
                const playerX = sourceEntity.location.x;
                const playerZ = sourceEntity.location.z;

                console.log(
                    `[MapSync] Scan command received: (${min.x}, ${min.z}) to (${max.x}, ${max.z}) in ${dimension.id}, spiraling from player at (${playerX}, ${playerZ})`
                );

                // Queue chunks for generation, sorted by distance from player
                forceScanRange(dimension, min.x, min.z, max.x, max.z, playerX, playerZ);

                return {
                    status: CustomCommandStatus.Success,
                    message: `Queued chunks from (${min.x}, ${min.z}) to (${max.x}, ${max.z}) for generation (spiraling from your position)`,
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

        // Register the mapsync:queue command for queue management
        registry.registerCommand(
            {
                name: 'mapsync:queue',
                description: 'Manage the chunk generation queue (stats, clear, resort)',
                permissionLevel: CommandPermissionLevel.GameDirectors,
                optionalParameters: [{ name: 'action', type: CustomCommandParamType.String }],
            },
            (_origin: CustomCommandOrigin, action?: string): CustomCommandResult => {
                const stats = getQueueStats();

                if (action === 'clear') {
                    clearQueue();
                    return {
                        status: CustomCommandStatus.Success,
                        message: 'Queue cleared',
                    };
                }

                if (action === 'resort') {
                    resortQueue();
                    return {
                        status: CustomCommandStatus.Success,
                        message: `Queue resorted. ${stats.queueSize} jobs pending.`,
                    };
                }

                // Default: show stats
                const priorityNames = ['Immediate', 'High', 'Normal', 'Low'];
                const priorityInfo = priorityNames
                    .map((name, i) => `${name}: ${stats.byPriority[i as 0 | 1 | 2 | 3]}`)
                    .join(', ');

                return {
                    status: CustomCommandStatus.Success,
                    message: `Queue: ${stats.queueSize} jobs (${priorityInfo}). Processed: ${stats.jobsProcessed}`,
                };
            }
        );

        console.log('[MapSync] Custom commands registered');
    });
}
