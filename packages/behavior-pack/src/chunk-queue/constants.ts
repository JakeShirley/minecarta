/**
 * Constants for the Chunk Queue module
 */

/**
 * Maximum number of job completion times to track for ETA calculation
 */
export const MAX_TIMING_HISTORY = 50;

/**
 * Interval in jobs between status updates (every N jobs)
 */
export const STATUS_UPDATE_INTERVAL_JOBS = 5;

/**
 * Minimum interval between status updates in milliseconds
 */
export const STATUS_UPDATE_MIN_INTERVAL_MS = 2000;

/**
 * Maximum jobs to process per tick to avoid lag.
 * With ticking areas, we process one at a time to ensure proper loading.
 */
export const MAX_JOBS_PER_TICK = 1;

/**
 * Interval in ticks between processing (default: 2 ticks)
 */
export const PROCESS_INTERVAL_TICKS = 2;

/**
 * Maximum number of attempts to wait for a chunk to load.
 * Each attempt waits 1 tick before checking again.
 */
export const MAX_CHUNK_LOAD_ATTEMPTS = 10;

/**
 * Minimum expected blocks in a 16x16 chunk.
 * If we get fewer blocks than this, the chunk probably wasn't fully loaded.
 * A full chunk should have 256 blocks (16x16), but some may be air.
 * We use a threshold of 50% to account for areas that might be partially air (like oceans).
 */
export const MIN_BLOCKS_THRESHOLD = 128;

/**
 * Maximum number of chunks to flood-fill when finding structure extents.
 * This prevents runaway expansion for very large structures.
 */
export const MAX_FLOOD_FILL_CHUNKS = 100;

/**
 * Spiral direction offsets for flood-fill exploration.
 * Ordered: right, down, left, up (clockwise spiral)
 */
export const SPIRAL_DIRECTIONS = [
    { dx: 1, dz: 0 }, // right
    { dx: 0, dz: 1 }, // down
    { dx: -1, dz: 0 }, // left
    { dx: 0, dz: -1 }, // up
] as const;

/**
 * Logging tag for this module
 */
export const LOG_TAG = 'ChunkQueue';
