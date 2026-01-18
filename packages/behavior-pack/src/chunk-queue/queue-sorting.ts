/**
 * Queue re-sorting based on player positions
 */

import { world } from '@minecraft/server';
import type { Dimension } from '@minecarta/shared';
import { toDimension } from '../blocks';
import { logDebug } from '../logging';
import { ChunkJobDataKind, ChunkJobPriority } from './types';
import { LOG_TAG } from './constants';
import { getJobQueue, sortQueue } from './queue-state';
import { getJobChunkCoords } from './dimension-utils';

/**
 * Calculate the distance from a chunk to the nearest player
 *
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @param dimension - The dimension
 * @param playerPositions - Map of player positions by dimension
 * @returns Distance in chunks, or Infinity if no players in dimension
 */
function distanceToNearestPlayer(
    chunkX: number,
    chunkZ: number,
    dimension: Dimension,
    playerPositions: Map<Dimension, Array<{ chunkX: number; chunkZ: number }>>
): number {
    const players = playerPositions.get(dimension);
    if (!players || players.length === 0) {
        return Infinity;
    }

    let minDistance = Infinity;
    for (const player of players) {
        const dx = chunkX - player.chunkX;
        const dz = chunkZ - player.chunkZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance < minDistance) {
            minDistance = distance;
        }
    }

    return minDistance;
}

/**
 * Re-sort the queue based on current player positions.
 * Jobs closer to players get higher priority within their priority level.
 *
 * This should be called when:
 * - Player positions change significantly
 * - Queue has a lot of pending work
 * - Periodically during heavy generation
 */
export function resortQueue(): void {
    const jobQueue = getJobQueue();

    if (jobQueue.length <= 1) {
        return; // Nothing to sort
    }

    // Collect current player positions by dimension
    const playerPositions = new Map<Dimension, Array<{ chunkX: number; chunkZ: number }>>();

    for (const player of world.getAllPlayers()) {
        try {
            const dimension = toDimension(player.dimension.id);
            const chunkX = Math.floor(player.location.x / 16);
            const chunkZ = Math.floor(player.location.z / 16);

            let positions = playerPositions.get(dimension);
            if (!positions) {
                positions = [];
                playerPositions.set(dimension, positions);
            }
            positions.push({ chunkX, chunkZ });
        } catch {
            // Skip invalid players
        }
    }

    // Calculate distance for each job and use it as a secondary sort key
    // We'll upgrade priority for jobs very close to players
    for (const job of jobQueue) {
        const coords = getJobChunkCoords(job);
        const distance = distanceToNearestPlayer(coords.chunkX, coords.chunkZ, job.dimension, playerPositions);

        // Upgrade priority for color/height jobs within 2 chunks of a player
        if (job.dataKind === ChunkJobDataKind.ColorHeight) {
            if (distance <= 2 && job.priority > ChunkJobPriority.High) {
                job.priority = ChunkJobPriority.High;
            } else if (distance <= 5 && job.priority > ChunkJobPriority.Normal) {
                job.priority = ChunkJobPriority.Normal;
            }
        }
    }

    // Re-sort the queue
    sortQueue();

    logDebug(LOG_TAG, `Queue resorted with ${jobQueue.length} jobs`);
}
