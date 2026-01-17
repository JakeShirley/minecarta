/**
 * Public API for adding jobs to the queue
 */

import type { Dimension } from '@minecarta/shared';
import type { FullChunkJob, AreaScanJob, AddJobOptions } from './types';
import { ChunkJobType, ChunkJobPriority } from './types';
import { generateJobId, insertJob, isJobPending } from './queue-state';

/**
 * Queue a full chunk for generation
 *
 * @param dimension - The dimension to scan
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @param options - Job options (priority, source player)
 */
export function queueChunk(dimension: Dimension, chunkX: number, chunkZ: number, options: AddJobOptions = {}): void {
    const job: FullChunkJob = {
        id: generateJobId(),
        type: ChunkJobType.FullChunk,
        dimension,
        chunkX,
        chunkZ,
        priority: options.priority ?? ChunkJobPriority.Normal,
        createdAt: Date.now(),
        sourcePlayer: options.sourcePlayer,
    };

    insertJob(job);
}

/**
 * Queue an area scan around a center point
 *
 * @param dimension - The dimension to scan
 * @param centerX - Center X coordinate (world coordinates)
 * @param centerZ - Center Z coordinate (world coordinates)
 * @param radius - Radius to scan (e.g., 1 for 3x3)
 * @param options - Job options (priority, source player)
 */
export function queueAreaScan(
    dimension: Dimension,
    centerX: number,
    centerZ: number,
    radius: number,
    options: AddJobOptions = {}
): void {
    const job: AreaScanJob = {
        id: generateJobId(),
        type: ChunkJobType.AreaScan,
        dimension,
        centerX,
        centerZ,
        radius,
        priority: options.priority ?? ChunkJobPriority.Immediate,
        createdAt: Date.now(),
        sourcePlayer: options.sourcePlayer,
    };

    insertJob(job);
}

/**
 * Queue multiple chunks for generation (e.g., for auto-gen)
 *
 * @param dimension - The dimension to scan
 * @param chunks - Array of chunk coordinates [{chunkX, chunkZ}]
 * @param options - Job options (priority, source player)
 */
export function queueChunks(
    dimension: Dimension,
    chunks: ReadonlyArray<{ chunkX: number; chunkZ: number }>,
    options: AddJobOptions = {}
): void {
    for (const { chunkX, chunkZ } of chunks) {
        queueChunk(dimension, chunkX, chunkZ, options);
    }
}

/**
 * Check if a specific chunk is already queued
 *
 * @param dimension - The dimension
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @returns True if the chunk is already in the queue
 */
export function isChunkQueued(dimension: Dimension, chunkX: number, chunkZ: number): boolean {
    const key = `chunk:${dimension}:${chunkX}:${chunkZ}`;
    return isJobPending(key);
}
