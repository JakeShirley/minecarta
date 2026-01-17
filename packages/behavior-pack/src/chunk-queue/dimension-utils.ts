/**
 * Dimension utility functions for the Chunk Queue module
 */

import { world } from '@minecraft/server';
import type { Dimension as MinecraftDimension } from '@minecraft/server';
import type { Dimension } from '@minecarta/shared';
import type { ChunkJob } from './types';
import { ChunkJobType } from './types';

/**
 * Get the Minecraft dimension object from our dimension type
 *
 * @param dimension - The dimension identifier
 * @returns The Minecraft dimension object
 */
export function getMinecraftDimension(dimension: Dimension): MinecraftDimension {
    const dimensionId =
        dimension === 'overworld'
            ? 'minecraft:overworld'
            : dimension === 'nether'
              ? 'minecraft:nether'
              : 'minecraft:the_end';

    return world.getDimension(dimensionId);
}

/**
 * Get the block coordinates for a job's ticking area
 *
 * @param job - The chunk job
 * @returns Bounds object with min/max X and Z coordinates
 */
export function getJobBlockBounds(job: ChunkJob): { minX: number; minZ: number; maxX: number; maxZ: number } {
    if (job.type === ChunkJobType.FullChunk) {
        // Full chunk: 16x16 area
        const minX = job.chunkX * 16;
        const minZ = job.chunkZ * 16;
        return {
            minX,
            minZ,
            maxX: minX + 15,
            maxZ: minZ + 15,
        };
    } else {
        // Area scan: centered on point with radius
        return {
            minX: job.centerX - job.radius,
            minZ: job.centerZ - job.radius,
            maxX: job.centerX + job.radius,
            maxZ: job.centerZ + job.radius,
        };
    }
}

/**
 * Get chunk coordinates for a job (for distance calculations)
 *
 * @param job - The chunk job
 * @returns Chunk coordinates
 */
export function getJobChunkCoords(job: ChunkJob): { chunkX: number; chunkZ: number } {
    if (job.type === ChunkJobType.FullChunk) {
        return { chunkX: job.chunkX, chunkZ: job.chunkZ };
    } else {
        return {
            chunkX: Math.floor(job.centerX / 16),
            chunkZ: Math.floor(job.centerZ / 16),
        };
    }
}
