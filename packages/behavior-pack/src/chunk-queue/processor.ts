/**
 * Queue processor control for the Chunk Queue module
 */

import { system } from '@minecraft/server';
import type { serializeChunkData } from '../serializers';
import { sendChunkData, sendStructures } from '../network';
import type { StructureData } from '../network';
import { logDebug, logWarning } from '../logging';
import type { QueueStats } from './types';
import { ChunkJobType, ChunkJobPriority } from './types';
import { LOG_TAG, MAX_JOBS_PER_TICK, PROCESS_INTERVAL_TICKS } from './constants';
import { startJobTiming, completeJobTiming } from './timing';
import { sendStatusUpdate, shouldSendStatusUpdate } from './status';
import {
    getJobQueue,
    getQueueLength,
    getIsProcessing,
    setIsProcessing,
    getProcessorRunId,
    setProcessorRunId,
    getTotalJobsProcessed,
    getCurrentBatch,
    setCurrentBatch,
    incrementTotalJobsProcessed,
    incrementBatchCompletedJobs,
    getBatchCompletedJobs,
    removeJobTracking,
    resetBatchTracking,
    takeJobs,
    clearQueue as clearQueueState,
} from './queue-state';
import { processJobWithTickingArea, processJobDirect, cleanupTickingArea } from './job-processing';
import { detectStructures } from './structure-detection';
import { getMinecraftDimension } from './dimension-utils';
import { resortQueue } from './queue-sorting';
import type { FullChunkJob } from './types';

/**
 * Process jobs from the queue
 * Called periodically by the processor interval
 */
async function processQueue(): Promise<void> {
    const queueLength = getQueueLength();

    if (queueLength === 0) {
        // If we just finished a batch, send a final status update
        if (getBatchCompletedJobs() > 0) {
            await sendStatusUpdate();
            resetBatchTracking();
        }
        return;
    }

    // Take up to MAX_JOBS_PER_TICK jobs from the queue
    const jobsToProcess = takeJobs(MAX_JOBS_PER_TICK);
    setCurrentBatch(jobsToProcess);

    const chunkDataBatch: Array<ReturnType<typeof serializeChunkData>> = [];
    const structuresBatch: StructureData[] = [];

    for (const job of jobsToProcess) {
        let result: ReturnType<typeof serializeChunkData> | null = null;

        // Start timing this job
        startJobTiming();

        // For immediate priority (player interactions), the chunk is already loaded
        // so we can process directly without a ticking area
        if (job.priority === ChunkJobPriority.Immediate) {
            result = processJobDirect(job);
        } else {
            // For other priorities, use a ticking area to ensure chunk is loaded
            result = await processJobWithTickingArea(job);
        }

        // Detect structures for full chunk jobs (after chunk is loaded)
        if (result && job.type === ChunkJobType.FullChunk) {
            const dimension = getMinecraftDimension(job.dimension);
            const structures = detectStructures(dimension, job as FullChunkJob);
            structuresBatch.push(...structures);
        }

        // Record job timing
        completeJobTiming();

        if (result) {
            chunkDataBatch.push(result);
        }
        removeJobTracking(job);
        incrementTotalJobsProcessed();
        incrementBatchCompletedJobs();

        // Send status update periodically
        if (shouldSendStatusUpdate()) {
            await sendStatusUpdate();
        }
    }

    setCurrentBatch([]);

    // Send batch to server if we have data
    if (chunkDataBatch.length > 0) {
        try {
            await sendChunkData(chunkDataBatch);
            logDebug(LOG_TAG, `Sent batch of ${chunkDataBatch.length} chunks`);
        } catch (error) {
            logWarning(LOG_TAG, 'Failed to send chunk batch', error);
        }
    }

    // Send discovered structures to server
    if (structuresBatch.length > 0) {
        try {
            await sendStructures(structuresBatch);
            logDebug(LOG_TAG, `Sent ${structuresBatch.length} structures`);
        } catch (error) {
            logWarning(LOG_TAG, 'Failed to send structures', error);
        }
    }

    // If queue is still large, consider re-sorting
    if (getQueueLength() > 50) {
        resortQueue();
    }
}

/**
 * Start the queue processor
 * Should be called once during initialization
 */
export function startQueueProcessor(): void {
    if (getProcessorRunId() !== null) {
        logDebug(LOG_TAG, 'Queue processor already running');
        return;
    }

    setIsProcessing(true);
    const runId = system.runInterval(() => {
        processQueue().catch(error => {
            logWarning(LOG_TAG, 'Queue processor error', error);
        });
    }, PROCESS_INTERVAL_TICKS);
    setProcessorRunId(runId);

    logDebug(LOG_TAG, 'Queue processor started');
}

/**
 * Stop the queue processor
 */
export function stopQueueProcessor(): void {
    const runId = getProcessorRunId();
    if (runId !== null) {
        system.clearRun(runId);
        setProcessorRunId(null);
        setIsProcessing(false);
        // Clean up any pending ticking area
        cleanupTickingArea();
        logDebug(LOG_TAG, 'Queue processor stopped');
    }
}

/**
 * Clear all pending jobs from the queue
 */
export function clearQueue(): void {
    clearQueueState();
}

/**
 * Get current queue statistics
 */
export function getQueueStats(): QueueStats {
    const jobQueue = getJobQueue();
    const byPriority: Record<ChunkJobPriority, number> = {
        [ChunkJobPriority.Immediate]: 0,
        [ChunkJobPriority.High]: 0,
        [ChunkJobPriority.Normal]: 0,
        [ChunkJobPriority.Low]: 0,
    };

    for (const job of jobQueue) {
        byPriority[job.priority]++;
    }

    return {
        queueSize: jobQueue.length,
        byPriority,
        isProcessing: getIsProcessing(),
        jobsProcessed: getTotalJobsProcessed(),
        currentBatchSize: getCurrentBatch().length,
    };
}
