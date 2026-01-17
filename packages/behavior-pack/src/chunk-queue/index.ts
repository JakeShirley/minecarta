/**
 * Chunk Generation Job Queue
 *
 * This module provides a centralized queue for all chunk generation work.
 * Jobs can be prioritized and the queue can be re-sorted when needed
 * (e.g., when player positions change significantly).
 */

// Re-export types
export type { ChunkJob, FullChunkJob, AreaScanJob, AddJobOptions, QueueStats } from './types';
export { ChunkJobPriority, ChunkJobType } from './types';

// Re-export public queue API
export { queueChunk, queueAreaScan, queueChunks, isChunkQueued } from './queue-api';

// Re-export queue sorting
export { resortQueue } from './queue-sorting';

// Re-export processor control
export { startQueueProcessor, stopQueueProcessor, clearQueue, getQueueStats } from './processor';

// Re-export status
export { getQueueStatus } from './status';
