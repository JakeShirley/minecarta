/**
 * Type definitions for the Chunk Queue module
 */

import type { Dimension } from '@minecarta/shared';

/**
 * Priority levels for chunk generation jobs.
 * Lower numbers = higher priority.
 */
export enum ChunkJobPriority {
    /** Immediate - player interaction (block place/break) */
    Immediate = 0,
    /** High - player's current chunk */
    High = 1,
    /** Normal - chunks near players */
    Normal = 2,
    /** Low - background generation (auto-gen) */
    Low = 3,
}

/**
 * Type of chunk generation job
 */
export enum ChunkJobType {
    /** Full 16x16 chunk scan */
    FullChunk = 'full-chunk',
    /** Small area scan (e.g., 3x3 around a block) */
    AreaScan = 'area-scan',
}

/**
 * Base interface for all chunk jobs
 */
interface ChunkJobBase {
    /** Unique identifier for the job */
    readonly id: string;
    /** Priority level */
    priority: ChunkJobPriority;
    /** Timestamp when job was created */
    readonly createdAt: number;
    /** The dimension to scan */
    readonly dimension: Dimension;
    /** Optional source player name (for priority calculations) */
    readonly sourcePlayer?: string;
}

/**
 * Job to scan a full chunk
 */
export interface FullChunkJob extends ChunkJobBase {
    readonly type: ChunkJobType.FullChunk;
    readonly chunkX: number;
    readonly chunkZ: number;
}

/**
 * Job to scan a small area around a point
 */
export interface AreaScanJob extends ChunkJobBase {
    readonly type: ChunkJobType.AreaScan;
    readonly centerX: number;
    readonly centerZ: number;
    readonly radius: number;
}

/**
 * Union type for all chunk jobs
 */
export type ChunkJob = FullChunkJob | AreaScanJob;

/**
 * Options for adding a job to the queue
 */
export interface AddJobOptions {
    /** Priority level (default: Normal) */
    priority?: ChunkJobPriority;
    /** Source player name for priority calculations */
    sourcePlayer?: string;
}

/**
 * Queue statistics
 */
export interface QueueStats {
    /** Total jobs in queue */
    readonly queueSize: number;
    /** Jobs by priority */
    readonly byPriority: Record<ChunkJobPriority, number>;
    /** Whether the processor is running */
    readonly isProcessing: boolean;
    /** Number of jobs processed */
    readonly jobsProcessed: number;
    /** Number of jobs currently being processed in batch */
    readonly currentBatchSize: number;
}
