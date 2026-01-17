/**
 * Queue state management for the Chunk Queue module.
 * Centralizes all mutable queue state to ensure consistency.
 */

import type { ChunkJob } from './types';
import { ChunkJobPriority, ChunkJobType } from './types';
import { logDebug } from '../logging';
import { LOG_TAG } from './constants';

/**
 * The job queue, sorted by priority then by creation time
 */
let jobQueue: ChunkJob[] = [];

/**
 * Set of job keys currently in queue (for deduplication)
 * Key format: "type:dimension:coords"
 */
const pendingJobs: Set<string> = new Set();

/**
 * Counter for generating unique job IDs
 */
let jobIdCounter = 0;

/**
 * Whether the queue processor is currently running
 */
let isProcessing = false;

/**
 * Run ID for the queue processor interval
 */
let processorRunId: number | null = null;

/**
 * Total jobs processed (for stats)
 */
let totalJobsProcessed = 0;

/**
 * Current batch being processed
 */
let currentBatch: ChunkJob[] = [];

/**
 * Total jobs added to the current batch (for percentage calculation)
 * Resets when queue becomes empty
 */
let batchTotalJobs = 0;

/**
 * Jobs completed in the current batch
 */
let batchCompletedJobs = 0;

/**
 * Current ticking area ID being used for chunk loading
 */
let currentTickingAreaId: string | null = null;

/**
 * Counter for generating unique ticking area IDs
 */
let tickingAreaCounter = 0;

// ==========================================
// Getters
// ==========================================

export function getJobQueue(): ChunkJob[] {
    return jobQueue;
}

export function getQueueLength(): number {
    return jobQueue.length;
}

export function isJobPending(key: string): boolean {
    return pendingJobs.has(key);
}

export function getIsProcessing(): boolean {
    return isProcessing;
}

export function getProcessorRunId(): number | null {
    return processorRunId;
}

export function getTotalJobsProcessed(): number {
    return totalJobsProcessed;
}

export function getCurrentBatch(): ChunkJob[] {
    return currentBatch;
}

export function getBatchTotalJobs(): number {
    return batchTotalJobs;
}

export function getBatchCompletedJobs(): number {
    return batchCompletedJobs;
}

export function getCurrentTickingAreaId(): string | null {
    return currentTickingAreaId;
}

// ==========================================
// Setters / Mutators
// ==========================================

export function setJobQueue(queue: ChunkJob[]): void {
    jobQueue = queue;
}

export function addPendingJob(key: string): void {
    pendingJobs.add(key);
}

export function removePendingJob(key: string): void {
    pendingJobs.delete(key);
}

export function setIsProcessing(value: boolean): void {
    isProcessing = value;
}

export function setProcessorRunId(id: number | null): void {
    processorRunId = id;
}

export function incrementTotalJobsProcessed(): void {
    totalJobsProcessed++;
}

export function setCurrentBatch(batch: ChunkJob[]): void {
    currentBatch = batch;
}

export function incrementBatchTotalJobs(): void {
    batchTotalJobs++;
}

export function incrementBatchCompletedJobs(): void {
    batchCompletedJobs++;
}

export function setCurrentTickingAreaId(id: string | null): void {
    currentTickingAreaId = id;
}

export function generateTickingAreaId(): string {
    return `mapsync_chunk_${++tickingAreaCounter}_${Date.now()}`;
}

// ==========================================
// Job ID Generation
// ==========================================

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
    return `job-${++jobIdCounter}-${Date.now()}`;
}

// ==========================================
// Job Key Generation
// ==========================================

/**
 * Generate a unique key for a job (for deduplication)
 */
export function getJobKey(job: ChunkJob): string {
    if (job.type === ChunkJobType.FullChunk) {
        return `chunk:${job.dimension}:${job.chunkX}:${job.chunkZ}`;
    } else {
        return `area:${job.dimension}:${job.centerX}:${job.centerZ}:${job.radius}`;
    }
}

// ==========================================
// Batch Tracking
// ==========================================

/**
 * Reset batch tracking when queue becomes empty
 */
export function resetBatchTracking(): void {
    batchTotalJobs = 0;
    batchCompletedJobs = 0;
}

// ==========================================
// Queue Operations
// ==========================================

/**
 * Compare function for sorting jobs by priority, then by creation time
 */
export function compareJobs(a: ChunkJob, b: ChunkJob): number {
    // Lower priority number = higher priority (should come first)
    if (a.priority !== b.priority) {
        return a.priority - b.priority;
    }
    // Earlier created = higher priority
    return a.createdAt - b.createdAt;
}

/**
 * Insert a job into the queue maintaining sort order
 */
export function insertJob(job: ChunkJob): void {
    const key = getJobKey(job);

    // Check for duplicates
    if (pendingJobs.has(key)) {
        // Job already exists, check if we should upgrade priority
        const existingIndex = jobQueue.findIndex(j => getJobKey(j) === key);
        if (existingIndex !== -1 && job.priority < jobQueue[existingIndex].priority) {
            // Upgrade the existing job's priority
            jobQueue[existingIndex] = { ...jobQueue[existingIndex], priority: job.priority };
            // Re-sort to maintain order
            jobQueue.sort(compareJobs);
            logDebug(LOG_TAG, `Upgraded job priority: ${key} to ${ChunkJobPriority[job.priority]}`);
        }
        return;
    }

    // Add to pending set
    pendingJobs.add(key);

    // Track batch total for percentage calculation
    batchTotalJobs++;

    // Binary search insertion to maintain sorted order
    let low = 0;
    let high = jobQueue.length;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (compareJobs(job, jobQueue[mid]) < 0) {
            high = mid;
        } else {
            low = mid + 1;
        }
    }

    jobQueue.splice(low, 0, job);
    logDebug(
        LOG_TAG,
        `Added job: ${key} at position ${low}/${jobQueue.length}, priority=${ChunkJobPriority[job.priority]}`
    );
}

/**
 * Remove a job from tracking after processing
 */
export function removeJobTracking(job: ChunkJob): void {
    const key = getJobKey(job);
    pendingJobs.delete(key);
}

/**
 * Take jobs from the front of the queue
 */
export function takeJobs(count: number): ChunkJob[] {
    return jobQueue.splice(0, count);
}

/**
 * Clear all pending jobs from the queue
 */
export function clearQueue(): void {
    jobQueue = [];
    pendingJobs.clear();
    resetBatchTracking();
    logDebug(LOG_TAG, 'Queue cleared');
}

/**
 * Sort the queue
 */
export function sortQueue(): void {
    jobQueue.sort(compareJobs);
}
