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
import type { CustomCommandOrigin, CustomCommandResult } from '@minecraft/server';
import { serializeChunkData } from '../serializers';
import { sendChunkData } from '../network';
import { config } from '../config';
import { scanChunk } from '../blocks';

/**
 * Log debug messages
 */
function logDebug(message: string, data?: unknown): void {
  if (config.debug) {
    console.log(`[MapSync Commands] ${message}`, data ? JSON.stringify(data) : '');
  }
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

    console.log('[MapSync] Custom commands registered');
  });
}
