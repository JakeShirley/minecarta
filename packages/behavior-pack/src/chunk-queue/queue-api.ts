/**
 * Public API for adding jobs to the queue
 */

import type { Dimension } from '@minecarta/shared';
import type { FullChunkJob, AreaScanJob, AddJobOptions } from './types';
import { ChunkJobType, ChunkJobPriority, ChunkJobDataKind } from './types';
import { generateJobId, insertJob, isJobPending } from './queue-state';

function getLowerPriority(priority: ChunkJobPriority): ChunkJobPriority {
    switch (priority) {
        case ChunkJobPriority.Immediate:
            return ChunkJobPriority.High;
        case ChunkJobPriority.High:
            return ChunkJobPriority.Normal;
        case ChunkJobPriority.Normal:
            return ChunkJobPriority.Low;
        case ChunkJobPriority.Low:
        default:
            return ChunkJobPriority.Low;
    }
}

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
        dataKind: ChunkJobDataKind.ColorHeight,
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
        dataKind: ChunkJobDataKind.ColorHeight,
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
 * Queue multiple chunks for density generation (e.g., for auto-gen)
 *
 * @param dimension - The dimension to scan
 * @param chunks - Array of chunk coordinates [{chunkX, chunkZ}]
 * @param options - Job options (priority, source player)
 */
export function queueChunksDensity(
    dimension: Dimension,
    chunks: ReadonlyArray<{ chunkX: number; chunkZ: number }>,
    options: AddJobOptions = {}
): void {
    for (const { chunkX, chunkZ } of chunks) {
        queueChunkDensity(dimension, chunkX, chunkZ, options);
    }
}

/**
 * Queue a full chunk for density generation with lower priority
 */
export function queueChunkDensity(
    dimension: Dimension,
    chunkX: number,
    chunkZ: number,
    options: AddJobOptions = {}
): void {
    const basePriority = options.priority ?? ChunkJobPriority.Normal;
    const job: FullChunkJob = {
        id: generateJobId(),
        type: ChunkJobType.FullChunk,
        dataKind: ChunkJobDataKind.Density,
        dimension,
        chunkX,
        chunkZ,
        priority: getLowerPriority(basePriority),
        createdAt: Date.now(),
        sourcePlayer: options.sourcePlayer,
    };

    insertJob(job);
}

/**
 * Queue an area scan for density generation with lower priority
 */
export function queueAreaScanDensity(
    dimension: Dimension,
    centerX: number,
    centerZ: number,
    radius: number,
    options: AddJobOptions = {}
): void {
    const basePriority = options.priority ?? ChunkJobPriority.Immediate;
    const job: AreaScanJob = {
        id: generateJobId(),
        type: ChunkJobType.AreaScan,
        dataKind: ChunkJobDataKind.Density,
        dimension,
        centerX,
        centerZ,
        radius,
        priority: getLowerPriority(basePriority),
        createdAt: Date.now(),
        sourcePlayer: options.sourcePlayer,
    };

    insertJob(job);
}

/**
 * Check if a specific chunk is already queued
 *
 * @param dimension - The dimension
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @returns True if the chunk is already in the queue
 */
export function isChunkQueued(
    dimension: Dimension,
    chunkX: number,
    chunkZ: number,
    dataKind: ChunkJobDataKind = ChunkJobDataKind.ColorHeight
): boolean {
    const key = `chunk:${dataKind}:${dimension}:${chunkX}:${chunkZ}`;
    return isJobPending(key);
}
