/**
 * Job timing and ETA calculation for the Chunk Queue
 */

import { MAX_TIMING_HISTORY } from './constants';

/**
 * History of job completion times in milliseconds
 */
const jobTimingHistory: number[] = [];

/**
 * Timestamp when the current job started processing
 */
let currentJobStartTime: number | null = null;

/**
 * Record a job completion time
 *
 * @param durationMs - Duration of the job in milliseconds
 */
export function recordJobTiming(durationMs: number): void {
    jobTimingHistory.push(durationMs);
    if (jobTimingHistory.length > MAX_TIMING_HISTORY) {
        jobTimingHistory.shift();
    }
}

/**
 * Calculate the average job time from recent history
 *
 * @returns Average job time in milliseconds, or null if no history
 */
export function calculateAverageJobTime(): number | null {
    if (jobTimingHistory.length === 0) {
        return null;
    }
    const sum = jobTimingHistory.reduce((a, b) => a + b, 0);
    return sum / jobTimingHistory.length;
}

/**
 * Calculate estimated time to completion in milliseconds
 *
 * @param queueLength - Number of jobs remaining in the queue
 * @returns Estimated time in milliseconds, or null if cannot calculate
 */
export function calculateEta(queueLength: number): number | null {
    const avgTime = calculateAverageJobTime();
    if (avgTime === null || queueLength === 0) {
        return null;
    }
    return Math.round(avgTime * queueLength);
}

/**
 * Start timing a job
 */
export function startJobTiming(): void {
    currentJobStartTime = Date.now();
}

/**
 * Complete timing for the current job and record it
 */
export function completeJobTiming(): void {
    if (currentJobStartTime !== null) {
        const jobDuration = Date.now() - currentJobStartTime;
        recordJobTiming(jobDuration);
        currentJobStartTime = null;
    }
}
