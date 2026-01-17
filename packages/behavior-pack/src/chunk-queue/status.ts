/**
 * Queue status reporting and updates
 */

import type { ChunkQueueStatus } from '@minecarta/shared';
import { sendQueueStatus } from '../network';
import { logDebug, logWarning } from '../logging';
import { calculateAverageJobTime, calculateEta } from './timing';
import { getQueueLength, getBatchTotalJobs, getBatchCompletedJobs, getIsProcessing } from './queue-state';
import { LOG_TAG, STATUS_UPDATE_INTERVAL_JOBS, STATUS_UPDATE_MIN_INTERVAL_MS } from './constants';

/**
 * Timestamp of the last status update
 */
let lastStatusUpdateTime = 0;

/**
 * Get the current queue status for reporting
 */
export function getQueueStatus(): ChunkQueueStatus {
    const avgJobTimeMs = calculateAverageJobTime();
    const queueLength = getQueueLength();
    const etaMs = calculateEta(queueLength);
    const batchTotalJobs = getBatchTotalJobs();
    const batchCompletedJobs = getBatchCompletedJobs();
    const isProcessing = getIsProcessing();
    const totalCount = batchTotalJobs > 0 ? batchTotalJobs : batchCompletedJobs + queueLength;
    const completionPercent =
        totalCount > 0 ? Math.round((batchCompletedJobs / totalCount) * 100) : isProcessing ? 0 : 100;

    return {
        queueSize: queueLength,
        completedCount: batchCompletedJobs,
        totalCount,
        completionPercent,
        etaMs: etaMs !== null ? Math.round(etaMs) : null,
        avgJobTimeMs: avgJobTimeMs !== null ? Math.round(avgJobTimeMs) : null,
        isProcessing,
    };
}

/**
 * Check if we should send a status update
 */
export function shouldSendStatusUpdate(): boolean {
    const now = Date.now();
    if (now - lastStatusUpdateTime < STATUS_UPDATE_MIN_INTERVAL_MS) {
        return false;
    }
    const batchCompletedJobs = getBatchCompletedJobs();
    const queueLength = getQueueLength();
    // Send update every N jobs or when queue becomes empty
    return batchCompletedJobs % STATUS_UPDATE_INTERVAL_JOBS === 0 || queueLength === 0;
}

/**
 * Send a status update to the server
 */
export async function sendStatusUpdate(): Promise<void> {
    const status = getQueueStatus();
    lastStatusUpdateTime = Date.now();

    try {
        await sendQueueStatus(status);
        logDebug(
            LOG_TAG,
            `Status update: ${status.completedCount}/${status.totalCount} (${status.completionPercent}%), ETA: ${status.etaMs !== null ? `${Math.round(status.etaMs / 1000)}s` : 'calculating...'}`
        );
    } catch (error) {
        logWarning(LOG_TAG, 'Failed to send status update', error);
    }
}
