/**
 * Structure detection with flood fill algorithm
 */

import type { Dimension as MinecraftDimension } from '@minecraft/server';
import type { Dimension } from '@minecarta/shared';
import type { StructureData } from '../network';
import type { FullChunkJob } from './types';
import { logDebug, logError, logWarning } from '../logging';
import { LOG_TAG, MAX_FLOOD_FILL_CHUNKS, SPIRAL_DIRECTIONS } from './constants';

/**
 * Set of already-discovered structure keys to avoid re-discovering them.
 * Key format: "structureType:dimension:chunkX:chunkZ" for the origin chunk where it was first found.
 * We use a combination of structure type and approximate location to deduplicate.
 */
const discoveredStructures: Set<string> = new Set();

/**
 * Check if a structure exists at a given chunk location.
 *
 * @param dimension - The Minecraft dimension
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @param structureType - The structure type to look for
 * @returns True if the structure is present at this chunk
 */
function hasStructureAtChunk(
    dimension: MinecraftDimension,
    chunkX: number,
    chunkZ: number,
    structureType: string
): boolean {
    try {
        const centerX = chunkX * 16 + 8;
        const centerZ = chunkZ * 16 + 8;
        const centerY = 64;

        const structures = dimension.getGeneratedStructures({ x: centerX, y: centerY, z: centerZ });
        return structures.includes(structureType);
    } catch {
        return false;
    }
}

/**
 * Flood-fill to find all chunks containing a structure, starting from the origin chunk.
 * Uses BFS (breadth-first search) to expand outward and find the full extent.
 *
 * @param dimension - The Minecraft dimension
 * @param startChunkX - Starting chunk X coordinate
 * @param startChunkZ - Starting chunk Z coordinate
 * @param structureType - The structure type to trace
 * @returns Array of all chunk coordinates containing this structure
 */
function floodFillStructure(
    dimension: MinecraftDimension,
    startChunkX: number,
    startChunkZ: number,
    structureType: string
): Array<{ chunkX: number; chunkZ: number }> {
    const visited: Set<string> = new Set();
    const result: Array<{ chunkX: number; chunkZ: number }> = [];
    const queue: Array<{ chunkX: number; chunkZ: number }> = [{ chunkX: startChunkX, chunkZ: startChunkZ }];

    while (queue.length > 0 && result.length < MAX_FLOOD_FILL_CHUNKS) {
        const current = queue.shift()!;
        const key = `${current.chunkX}:${current.chunkZ}`;

        if (visited.has(key)) {
            continue;
        }
        visited.add(key);

        // Check if this chunk contains the structure
        if (!hasStructureAtChunk(dimension, current.chunkX, current.chunkZ, structureType)) {
            continue;
        }

        result.push(current);

        // Add neighbors to the queue
        for (const dir of SPIRAL_DIRECTIONS) {
            const neighborX = current.chunkX + dir.dx;
            const neighborZ = current.chunkZ + dir.dz;
            const neighborKey = `${neighborX}:${neighborZ}`;

            if (!visited.has(neighborKey)) {
                queue.push({ chunkX: neighborX, chunkZ: neighborZ });
            }
        }
    }

    return result;
}

/**
 * Calculate the extents and center of a structure from its chunk coordinates.
 *
 * @param chunks - Array of chunk coordinates containing the structure
 * @returns Object with extents (min/max block coords) and center point
 */
function calculateStructureExtents(chunks: Array<{ chunkX: number; chunkZ: number }>): {
    extents: { minX: number; maxX: number; minZ: number; maxZ: number };
    centerX: number;
    centerZ: number;
} {
    if (chunks.length === 0) {
        throw new Error('Cannot calculate extents for empty chunk list');
    }

    let minChunkX = chunks[0].chunkX;
    let maxChunkX = chunks[0].chunkX;
    let minChunkZ = chunks[0].chunkZ;
    let maxChunkZ = chunks[0].chunkZ;

    for (const chunk of chunks) {
        if (chunk.chunkX < minChunkX) minChunkX = chunk.chunkX;
        if (chunk.chunkX > maxChunkX) maxChunkX = chunk.chunkX;
        if (chunk.chunkZ < minChunkZ) minChunkZ = chunk.chunkZ;
        if (chunk.chunkZ > maxChunkZ) maxChunkZ = chunk.chunkZ;
    }

    // Convert chunk coordinates to block coordinates
    const minX = minChunkX * 16;
    const maxX = maxChunkX * 16 + 15;
    const minZ = minChunkZ * 16;
    const maxZ = maxChunkZ * 16 + 15;

    // Calculate center point
    const centerX = Math.floor((minX + maxX) / 2);
    const centerZ = Math.floor((minZ + maxZ) / 2);

    return {
        extents: { minX, maxX, minZ, maxZ },
        centerX,
        centerZ,
    };
}

/**
 * Generate a unique key for a discovered structure based on its approximate location.
 * Uses the center chunk coordinates to create a stable key.
 */
function getStructureKey(
    structureType: string,
    dimension: Dimension,
    centerChunkX: number,
    centerChunkZ: number
): string {
    return `${structureType}:${dimension}:${centerChunkX}:${centerChunkZ}`;
}

/**
 * Detect structures at the center of a chunk and flood-fill to find full extents.
 * Uses Dimension.getGeneratedStructures() to find structures at the given location,
 * then expands outward to find all chunks containing each structure.
 *
 * @param dimension - The Minecraft dimension
 * @param job - The chunk job containing dimension and coordinates
 * @returns Array of structure data found, with calculated extents and center
 */
export function detectStructures(dimension: MinecraftDimension, job: FullChunkJob): StructureData[] {
    const structures: StructureData[] = [];

    try {
        // Get a block near the center of the chunk at surface level
        const centerX = job.chunkX * 16 + 8;
        const centerZ = job.chunkZ * 16 + 8;
        const centerY = 64;

        // Get generated structures at this location
        const generatedStructures = dimension.getGeneratedStructures({ x: centerX, y: centerY, z: centerZ });

        if (generatedStructures.length > 0) {
            const timestamp = Date.now();

            for (const structureType of generatedStructures) {
                // Flood-fill to find all chunks containing this structure
                const structureChunks = floodFillStructure(dimension, job.chunkX, job.chunkZ, structureType);

                if (structureChunks.length === 0) {
                    continue;
                }

                // Calculate extents and center
                const {
                    extents,
                    centerX: calcCenterX,
                    centerZ: calcCenterZ,
                } = calculateStructureExtents(structureChunks);

                // Generate a key based on the calculated center chunk
                const centerChunkX = Math.floor(calcCenterX / 16);
                const centerChunkZ = Math.floor(calcCenterZ / 16);
                const structureKey = getStructureKey(structureType, job.dimension, centerChunkX, centerChunkZ);

                // Skip if we've already discovered this structure
                if (discoveredStructures.has(structureKey)) {
                    logDebug(LOG_TAG, `Skipping already-discovered structure: ${structureKey}`);
                    continue;
                }

                // Mark as discovered
                discoveredStructures.add(structureKey);

                structures.push({
                    structureType,
                    x: calcCenterX,
                    y: centerY,
                    z: calcCenterZ,
                    dimension: job.dimension,
                    extents,
                    discoveredAt: timestamp,
                });

                logWarning(
                    LOG_TAG,
                    `Found structure ${structureType} spanning ${structureChunks.length} chunks, center: (${calcCenterX}, ${calcCenterZ}), extents: (${extents.minX},${extents.minZ}) to (${extents.maxX},${extents.maxZ})`
                );
            }
        }
    } catch (error) {
        // Structure detection is optional, don't fail the job
        logError(LOG_TAG, `Structure detection failed for chunk (${job.chunkX}, ${job.chunkZ})`, error);
    }

    return structures;
}
