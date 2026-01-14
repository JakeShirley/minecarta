/**
 * Custom command registration for map sync operations
 */

import {
  system,
  world,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
} from '@minecraft/server';
import type { CustomCommandOrigin, CustomCommandResult, Player } from '@minecraft/server';
import { serializeChunkData } from '../serializers';
import { sendChunkData } from '../network';
import { config } from '../config';
import { scanChunk, scanArea, toDimension } from '../blocks';

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
    const currentPlayer = world.getAllPlayers().find((p) => p.name === playerName);
    if (!currentPlayer) {
      // Player disconnected, stop auto-gen
      stopAutoGen(playerName);
      return;
    }

    scanAroundPlayer(currentPlayer, radiusBlocks).catch((error) => {
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
 * Force scan a block range and submit all chunk tiles to the server
 *
 * @param dimensionId - The dimension to scan
 * @param minX - Minimum X coordinate (world coords)
 * @param minZ - Minimum Z coordinate (world coords)
 * @param maxX - Maximum X coordinate (world coords)
 * @param maxZ - Maximum Z coordinate (world coords)
 */
async function forceScanRange(
  dimensionId: string,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number
): Promise<{ chunksScanned: number; blocksSent: number }> {
  const dimension = world.getDimension(dimensionId);

  // Calculate chunk boundaries
  const minChunkX = Math.floor(minX / 16);
  const minChunkZ = Math.floor(minZ / 16);
  const maxChunkX = Math.floor(maxX / 16);
  const maxChunkZ = Math.floor(maxZ / 16);

  let chunksScanned = 0;
  let blocksSent = 0;
  const chunkDataBatch: ReturnType<typeof serializeChunkData>[] = [];

  console.log(
    `[MapSync] Force scanning chunks from (${minChunkX}, ${minChunkZ}) to (${maxChunkX}, ${maxChunkZ})`
  );

  // Scan all chunks in the range
  for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
    for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ++) {
      try {
        const chunkData = scanChunk(dimension, chunkX, chunkZ);
        chunksScanned++;
        blocksSent += chunkData.blocks.length;

        const serialized = serializeChunkData(chunkData);
        chunkDataBatch.push(serialized);

        // Send in batches of 10 chunks to avoid overwhelming the server
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

  return { chunksScanned, blocksSent };
}

/**
 * Register all custom commands
 */
export function registerCustomCommands(): void {
  system.beforeEvents.startup.subscribe((event) => {
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
        optionalParameters: [
          { name: 'dimension', type: CustomCommandParamType.String },
        ],
      },
      (origin: CustomCommandOrigin, min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }, dimensionId?: string): CustomCommandResult => {
        const targetDimension = dimensionId ?? origin.sourceEntity?.dimension?.id ?? 'minecraft:overworld';
        // Use the source entity's dimension if not specified, or default to overworld

        system.run(() => {

            console.log(
            `[MapSync] Scan command received: (${min.x}, ${min.z}) to (${max.x}, ${max.z}) in ${targetDimension}`
            );

            // Run the scan asynchronously
            forceScanRange(targetDimension, min.x, min.z, max.x, max.z)
            .then(({ chunksScanned, blocksSent }) => {
                console.log(
                `[MapSync] Force scan complete: ${chunksScanned} chunks, ${blocksSent} blocks sent`
                );
            })
            .catch((error) => {
                console.error('[MapSync] Force scan failed:', error);
            });
        });

        return {
          status: CustomCommandStatus.Success,
          message: `Starting force scan from (${min.x}, ${min.z}) to (${max.x}, ${max.z}) in ${targetDimension}`,
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
              message: 'Auto-generation is not active. Use: /mapsync:autogen <radius> <interval> to enable',
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
          const currentPlayer = world.getAllPlayers().find((p) => p.name === playerName);
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
