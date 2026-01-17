/**
 * Job processing logic for the Chunk Queue module
 */

import { system, world } from '@minecraft/server';
import { scanChunk, scanArea } from '../blocks';
import { serializeChunkData } from '../serializers';
import { logDebug, logWarning } from '../logging';
import type { ChunkJob } from './types';
import { ChunkJobType, ChunkJobPriority } from './types';
import { LOG_TAG, MAX_CHUNK_LOAD_ATTEMPTS, MIN_BLOCKS_THRESHOLD } from './constants';
import { getMinecraftDimension, getJobBlockBounds } from './dimension-utils';
import { getCurrentTickingAreaId, setCurrentTickingAreaId, generateTickingAreaId } from './queue-state';
import { queueChunk } from './queue-api';

/**
 * Clean up the current ticking area if one exists
 */
export function cleanupTickingArea(): void {
    const currentTickingAreaId = getCurrentTickingAreaId();
    if (currentTickingAreaId) {
        try {
            // Remove the ticking area
            world.tickingAreaManager.removeTickingArea(currentTickingAreaId);
            logDebug(LOG_TAG, `Removed ticking area: ${currentTickingAreaId}`);
        } catch (error) {
            logWarning(LOG_TAG, `Failed to remove ticking area: ${currentTickingAreaId}`, error);
        }
        setCurrentTickingAreaId(null);
    }
}

/**
 * Process a single job using a ticking area to ensure the chunk is loaded.
 * Returns a promise that resolves with the serialized chunk data.
 *
 * @param job - The chunk job to process
 * @returns Serialized chunk data or null if processing failed
 */
export async function processJobWithTickingArea(job: ChunkJob): Promise<ReturnType<typeof serializeChunkData> | null> {
    const dimension = getMinecraftDimension(job.dimension);
    const bounds = getJobBlockBounds(job);
    const tickingAreaId = generateTickingAreaId();

    try {
        // Create a ticking area to load the chunk
        logDebug(LOG_TAG, `Creating ticking area for job ${job.id}: ${tickingAreaId}`);

        // Create the ticking area - this loads the chunks
        // Only set currentTickingAreaId AFTER successful creation to avoid
        // trying to remove a ticking area that was never created
        await world.tickingAreaManager.createTickingArea(tickingAreaId, {
            dimension,
            from: { x: bounds.minX, y: 0, z: bounds.minZ },
            to: { x: bounds.maxX, y: 0, z: bounds.maxZ },
        });

        // Mark the ticking area as created only after successful creation
        setCurrentTickingAreaId(tickingAreaId);

        // Wait for the chunk to be loaded using the dimension's isChunkLoaded helper
        const checkLocation = {
            x: bounds.minX + 8, // Center of the area
            y: 64,
            z: bounds.minZ + 8,
        };

        let attempts = 0;
        while (!dimension.isChunkLoaded(checkLocation) && attempts < MAX_CHUNK_LOAD_ATTEMPTS) {
            await new Promise<void>(resolve => {
                system.runTimeout(() => resolve(), 1);
            });
            attempts++;
        }

        // Check if the chunk is now loaded
        if (!dimension.isChunkLoaded(checkLocation)) {
            logWarning(
                LOG_TAG,
                `Chunk at (${checkLocation.x}, ${checkLocation.z}) not loaded after ${MAX_CHUNK_LOAD_ATTEMPTS} attempts, will retry`
            );
            // Re-queue this job with low priority to try again later
            if (job.type === ChunkJobType.FullChunk) {
                queueChunk(job.dimension, job.chunkX, job.chunkZ, {
                    priority: ChunkJobPriority.Low,
                    sourcePlayer: job.sourcePlayer,
                });
            }
            return null;
        }

        logDebug(LOG_TAG, `Chunk loaded after ${attempts} attempts`);

        // Now scan the chunk/area
        let result: ReturnType<typeof serializeChunkData> | null = null;

        if (job.type === ChunkJobType.FullChunk) {
            const chunkData = scanChunk(dimension, job.chunkX, job.chunkZ);

            // Validate that we got enough blocks - if not, the chunk wasn't fully loaded
            if (chunkData.blocks.length < MIN_BLOCKS_THRESHOLD) {
                logWarning(
                    LOG_TAG,
                    `Chunk (${job.chunkX}, ${job.chunkZ}) only has ${chunkData.blocks.length} blocks (threshold: ${MIN_BLOCKS_THRESHOLD}), will retry`
                );
                // Re-queue this job to try again later
                queueChunk(job.dimension, job.chunkX, job.chunkZ, {
                    priority: ChunkJobPriority.Low,
                    sourcePlayer: job.sourcePlayer,
                });
                return null;
            }

            result = serializeChunkData(chunkData);
            logDebug(LOG_TAG, `Scanned chunk (${job.chunkX}, ${job.chunkZ}) with ${chunkData.blocks.length} blocks`);
        } else {
            const areaData = scanArea(dimension, job.centerX, job.centerZ, job.radius);
            result = serializeChunkData(areaData);
            logDebug(
                LOG_TAG,
                `Scanned area around (${job.centerX}, ${job.centerZ}) with ${areaData.blocks.length} blocks`
            );
        }

        return result;
    } catch (error) {
        logWarning(LOG_TAG, `Failed to process job ${job.id} with ticking area`, error);
        return null;
    } finally {
        // Always clean up the ticking area
        cleanupTickingArea();
    }
}

/**
 * Process a single job without a ticking area (for already-loaded chunks like player interactions)
 *
 * @param job - The chunk job to process
 * @returns Serialized chunk data or null if processing failed
 */
export function processJobDirect(job: ChunkJob): ReturnType<typeof serializeChunkData> | null {
    try {
        const dimension = getMinecraftDimension(job.dimension);

        if (job.type === ChunkJobType.FullChunk) {
            const chunkData = scanChunk(dimension, job.chunkX, job.chunkZ);
            return serializeChunkData(chunkData);
        } else {
            const areaData = scanArea(dimension, job.centerX, job.centerZ, job.radius);
            return serializeChunkData(areaData);
        }
    } catch (error) {
        logWarning(LOG_TAG, `Failed to process job ${job.id} directly`, error);
        return null;
    }
}
