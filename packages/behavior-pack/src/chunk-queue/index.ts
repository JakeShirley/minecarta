/**
 * Chunk Generation Job Queue
 *
 * This module provides a centralized queue for all chunk generation work.
 * Jobs can be prioritized and the queue can be re-sorted when needed
 * (e.g., when player positions change significantly).
 */

import { system, world } from '@minecraft/server';
import type { Dimension as MinecraftDimension } from '@minecraft/server';
import { scanChunk, scanArea, toDimension } from '../blocks';
import { serializeChunkData } from '../serializers';
import { sendChunkData } from '../network';
import { config } from '../config';
import type { Dimension } from '@minecarta/shared';

// ==========================================
// Types
// ==========================================

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

// ==========================================
// Queue Implementation
// ==========================================

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
 * Maximum jobs to process per tick to avoid lag.
 * With ticking areas, we process one at a time to ensure proper loading.
 */
const MAX_JOBS_PER_TICK = 1;

/**
 * Interval in ticks between processing (default: 2 ticks)
 */
const PROCESS_INTERVAL_TICKS = 2;

/**
 * Maximum number of attempts to wait for a chunk to load.
 * Each attempt waits 1 tick before checking again.
 */
const MAX_CHUNK_LOAD_ATTEMPTS = 10;

/**
 * Minimum expected blocks in a 16x16 chunk.
 * If we get fewer blocks than this, the chunk probably wasn't fully loaded.
 * A full chunk should have 256 blocks (16x16), but some may be air.
 * We use a threshold of 50% to account for areas that might be partially air (like oceans).
 */
const MIN_BLOCKS_THRESHOLD = 128;

/**
 * Current ticking area ID being used for chunk loading
 */
let currentTickingAreaId: string | null = null;

/**
 * Counter for generating unique ticking area IDs
 */
let tickingAreaCounter = 0;

// ==========================================
// Logging
// ==========================================

/**
 * Log debug messages if debug mode is enabled
 */
function logDebug(message: string, data?: unknown): void {
    if (config.debug) {
        if (data !== undefined) {
            console.log(`[ChunkQueue] ${message}`, JSON.stringify(data));
        } else {
            console.log(`[ChunkQueue] ${message}`);
        }
    }
}

// ==========================================
// Job Key Generation
// ==========================================

/**
 * Generate a unique key for a job (for deduplication)
 */
function getJobKey(job: ChunkJob): string {
    if (job.type === ChunkJobType.FullChunk) {
        return `chunk:${job.dimension}:${job.chunkX}:${job.chunkZ}`;
    } else {
        return `area:${job.dimension}:${job.centerX}:${job.centerZ}:${job.radius}`;
    }
}

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
    return `job-${++jobIdCounter}-${Date.now()}`;
}

// ==========================================
// Queue Operations
// ==========================================

/**
 * Compare function for sorting jobs by priority, then by creation time
 */
function compareJobs(a: ChunkJob, b: ChunkJob): number {
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
function insertJob(job: ChunkJob): void {
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
            logDebug(`Upgraded job priority: ${key} to ${ChunkJobPriority[job.priority]}`);
        }
        return;
    }

    // Add to pending set
    pendingJobs.add(key);

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
    logDebug(`Added job: ${key} at position ${low}/${jobQueue.length}, priority=${ChunkJobPriority[job.priority]}`);
}

/**
 * Remove a job from tracking after processing
 */
function removeJobTracking(job: ChunkJob): void {
    const key = getJobKey(job);
    pendingJobs.delete(key);
}

// ==========================================
// Public API - Adding Jobs
// ==========================================

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

// ==========================================
// Queue Re-sorting
// ==========================================

/**
 * Calculate the distance from a chunk to the nearest player
 *
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @param dimension - The dimension
 * @param playerPositions - Map of player positions by dimension
 * @returns Distance in chunks, or Infinity if no players in dimension
 */
function distanceToNearestPlayer(
    chunkX: number,
    chunkZ: number,
    dimension: Dimension,
    playerPositions: Map<Dimension, Array<{ chunkX: number; chunkZ: number }>>
): number {
    const players = playerPositions.get(dimension);
    if (!players || players.length === 0) {
        return Infinity;
    }

    let minDistance = Infinity;
    for (const player of players) {
        const dx = chunkX - player.chunkX;
        const dz = chunkZ - player.chunkZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance < minDistance) {
            minDistance = distance;
        }
    }

    return minDistance;
}

/**
 * Get chunk coordinates for a job (for distance calculations)
 */
function getJobChunkCoords(job: ChunkJob): { chunkX: number; chunkZ: number } {
    if (job.type === ChunkJobType.FullChunk) {
        return { chunkX: job.chunkX, chunkZ: job.chunkZ };
    } else {
        return {
            chunkX: Math.floor(job.centerX / 16),
            chunkZ: Math.floor(job.centerZ / 16),
        };
    }
}

/**
 * Re-sort the queue based on current player positions.
 * Jobs closer to players get higher priority within their priority level.
 *
 * This should be called when:
 * - Player positions change significantly
 * - Queue has a lot of pending work
 * - Periodically during heavy generation
 */
export function resortQueue(): void {
    if (jobQueue.length <= 1) {
        return; // Nothing to sort
    }

    // Collect current player positions by dimension
    const playerPositions = new Map<Dimension, Array<{ chunkX: number; chunkZ: number }>>();

    for (const player of world.getAllPlayers()) {
        try {
            const dimension = toDimension(player.dimension.id);
            const chunkX = Math.floor(player.location.x / 16);
            const chunkZ = Math.floor(player.location.z / 16);

            let positions = playerPositions.get(dimension);
            if (!positions) {
                positions = [];
                playerPositions.set(dimension, positions);
            }
            positions.push({ chunkX, chunkZ });
        } catch {
            // Skip invalid players
        }
    }

    // Calculate distance for each job and use it as a secondary sort key
    // We'll upgrade priority for jobs very close to players
    for (const job of jobQueue) {
        const coords = getJobChunkCoords(job);
        const distance = distanceToNearestPlayer(coords.chunkX, coords.chunkZ, job.dimension, playerPositions);

        // Upgrade priority for jobs within 2 chunks of a player
        if (distance <= 2 && job.priority > ChunkJobPriority.High) {
            job.priority = ChunkJobPriority.High;
        } else if (distance <= 5 && job.priority > ChunkJobPriority.Normal) {
            job.priority = ChunkJobPriority.Normal;
        }
    }

    // Re-sort the queue
    jobQueue.sort(compareJobs);

    logDebug(`Queue resorted with ${jobQueue.length} jobs`);
}

// ==========================================
// Job Processing
// ==========================================

/**
 * Get the Minecraft dimension object from our dimension type
 */
function getMinecraftDimension(dimension: Dimension): MinecraftDimension {
    const dimensionId =
        dimension === 'overworld'
            ? 'minecraft:overworld'
            : dimension === 'nether'
              ? 'minecraft:nether'
              : 'minecraft:the_end';

    return world.getDimension(dimensionId);
}

/**
 * Generate a unique ticking area ID for a job
 */
function generateTickingAreaId(): string {
    return `mapsync_chunk_${++tickingAreaCounter}_${Date.now()}`;
}

/**
 * Clean up the current ticking area if one exists
 */
function cleanupTickingArea(): void {
    if (currentTickingAreaId) {
        try {
            // Remove the ticking area
            world.tickingAreaManager.removeTickingArea(currentTickingAreaId);
            logDebug(`Removed ticking area: ${currentTickingAreaId}`);
        } catch (error) {
            logDebug(`Failed to remove ticking area: ${currentTickingAreaId}`, error);
        }
        currentTickingAreaId = null;
    }
}

/**
 * Get the block coordinates for a job's ticking area
 */
function getJobBlockBounds(job: ChunkJob): { minX: number; minZ: number; maxX: number; maxZ: number } {
    if (job.type === ChunkJobType.FullChunk) {
        // Full chunk: 16x16 area
        const minX = job.chunkX * 16;
        const minZ = job.chunkZ * 16;
        return {
            minX,
            minZ,
            maxX: minX + 15,
            maxZ: minZ + 15,
        };
    } else {
        // Area scan: centered on point with radius
        return {
            minX: job.centerX - job.radius,
            minZ: job.centerZ - job.radius,
            maxX: job.centerX + job.radius,
            maxZ: job.centerZ + job.radius,
        };
    }
}

/**
 * Process a single job using a ticking area to ensure the chunk is loaded.
 * Returns a promise that resolves with the serialized chunk data.
 */
async function processJobWithTickingArea(job: ChunkJob): Promise<ReturnType<typeof serializeChunkData> | null> {
    const dimension = getMinecraftDimension(job.dimension);
    const bounds = getJobBlockBounds(job);
    const tickingAreaId = generateTickingAreaId();

    try {
        // Create a ticking area to load the chunk
        logDebug(`Creating ticking area for job ${job.id}: ${tickingAreaId}`);

        // Create the ticking area - this loads the chunks
        // Only set currentTickingAreaId AFTER successful creation to avoid
        // trying to remove a ticking area that was never created
        await world.tickingAreaManager.createTickingArea(tickingAreaId, {
            dimension,
            from: { x: bounds.minX, y: 0, z: bounds.minZ },
            to: { x: bounds.maxX, y: 0, z: bounds.maxZ },
        });

        // Mark the ticking area as created only after successful creation
        currentTickingAreaId = tickingAreaId;

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
            logDebug(
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

        logDebug(`Chunk loaded after ${attempts} attempts`);

        // Now scan the chunk/area
        let result: ReturnType<typeof serializeChunkData> | null = null;

        if (job.type === ChunkJobType.FullChunk) {
            const chunkData = scanChunk(dimension, job.chunkX, job.chunkZ);

            // Validate that we got enough blocks - if not, the chunk wasn't fully loaded
            if (chunkData.blocks.length < MIN_BLOCKS_THRESHOLD) {
                logDebug(
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
            logDebug(`Scanned chunk (${job.chunkX}, ${job.chunkZ}) with ${chunkData.blocks.length} blocks`);
        } else {
            const areaData = scanArea(dimension, job.centerX, job.centerZ, job.radius);
            result = serializeChunkData(areaData);
            logDebug(`Scanned area around (${job.centerX}, ${job.centerZ}) with ${areaData.blocks.length} blocks`);
        }

        return result;
    } catch (error) {
        logDebug(`Failed to process job ${job.id} with ticking area`, error);
        return null;
    } finally {
        // Always clean up the ticking area
        cleanupTickingArea();
    }
}

/**
 * Process a single job without a ticking area (for already-loaded chunks like player interactions)
 */
function processJobDirect(job: ChunkJob): ReturnType<typeof serializeChunkData> | null {
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
        logDebug(`Failed to process job ${job.id} directly`, error);
        return null;
    }
}

/**
 * Process jobs from the queue
 * Called periodically by the processor interval
 */
async function processQueue(): Promise<void> {
    if (jobQueue.length === 0) {
        return;
    }

    // Take up to MAX_JOBS_PER_TICK jobs from the queue
    const jobsToProcess = jobQueue.splice(0, MAX_JOBS_PER_TICK);
    currentBatch = jobsToProcess;

    const chunkDataBatch: Array<ReturnType<typeof serializeChunkData>> = [];

    for (const job of jobsToProcess) {
        let result: ReturnType<typeof serializeChunkData> | null = null;

        // For immediate priority (player interactions), the chunk is already loaded
        // so we can process directly without a ticking area
        if (job.priority === ChunkJobPriority.Immediate) {
            result = processJobDirect(job);
        } else {
            // For other priorities, use a ticking area to ensure chunk is loaded
            result = await processJobWithTickingArea(job);
        }

        if (result) {
            chunkDataBatch.push(result);
        }
        removeJobTracking(job);
        totalJobsProcessed++;
    }

    currentBatch = [];

    // Send batch to server if we have data
    if (chunkDataBatch.length > 0) {
        try {
            await sendChunkData(chunkDataBatch);
            logDebug(`Sent batch of ${chunkDataBatch.length} chunks`);
        } catch (error) {
            logDebug('Failed to send chunk batch', error);
        }
    }

    // If queue is still large, consider re-sorting
    if (jobQueue.length > 50) {
        resortQueue();
    }
}

// ==========================================
// Queue Processor Control
// ==========================================

/**
 * Start the queue processor
 * Should be called once during initialization
 */
export function startQueueProcessor(): void {
    if (processorRunId !== null) {
        logDebug('Queue processor already running');
        return;
    }

    isProcessing = true;
    processorRunId = system.runInterval(() => {
        processQueue().catch(error => {
            logDebug('Queue processor error', error);
        });
    }, PROCESS_INTERVAL_TICKS);

    logDebug('Queue processor started');
}

/**
 * Stop the queue processor
 */
export function stopQueueProcessor(): void {
    if (processorRunId !== null) {
        system.clearRun(processorRunId);
        processorRunId = null;
        isProcessing = false;
        // Clean up any pending ticking area
        cleanupTickingArea();
        logDebug('Queue processor stopped');
    }
}

/**
 * Clear all pending jobs from the queue
 */
export function clearQueue(): void {
    jobQueue = [];
    pendingJobs.clear();
    logDebug('Queue cleared');
}

/**
 * Get current queue statistics
 */
export function getQueueStats(): QueueStats {
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
        isProcessing,
        jobsProcessed: totalJobsProcessed,
        currentBatchSize: currentBatch.length,
    };
}

/**
 * Check if a specific chunk is already queued
 */
export function isChunkQueued(dimension: Dimension, chunkX: number, chunkZ: number): boolean {
    const key = `chunk:${dimension}:${chunkX}:${chunkZ}`;
    return pendingJobs.has(key);
}
