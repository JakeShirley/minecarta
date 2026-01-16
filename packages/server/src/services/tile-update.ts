import type { ChunkData, ChunkBlock, BlockChange, Dimension, ZoomLevel, TileCoordinates } from '@minecarta/shared';
import { ZOOM_LEVELS, MAP_TYPES } from '@minecarta/shared';
import { getTileStorageService } from '../tiles/tile-storage.js';
import { getTileGeneratorService } from '../tiles/tile-generator.js';
import { getWebSocketService } from './websocket.js';

/**
 * Block update data with partial info (block changes only have type, no color)
 * For block changes we only need to invalidate the tile, the color will be
 * obtained from the next chunk scan.
 */
interface BlockUpdateData {
    x: number;
    y: number;
    z: number;
    type: string;
}

interface TileUpdateTask {
    dimension: Dimension;
    zoom: ZoomLevel;
    x: number;
    z: number;
    blocks: ChunkBlock[];
}

interface TileInvalidationTask {
    dimension: Dimension;
    zoom: ZoomLevel;
    x: number;
    z: number;
    blockUpdates: BlockUpdateData[];
}

/**
 * Creates a unique key for a tile to be used for locking.
 * Format: "dimension:mapType:zoom:x:z"
 */
function createTileLockKey(dimension: Dimension, mapType: string, zoom: ZoomLevel, x: number, z: number): string {
    return `${dimension}:${mapType}:${zoom}:${x}:${z}`;
}

export class TileUpdateService {
    /**
     * Map of tile lock keys to their current lock promise.
     * When a tile is being updated, its key maps to a promise that resolves when the update completes.
     * Subsequent updates to the same tile will wait for this promise before starting.
     */
    private tileLocks = new Map<string, Promise<void>>();
    /**
     * Process a batch of chunks and update tiles
     */
    async processChunks(chunks: ChunkData[]): Promise<void> {
        const storage = getTileStorageService();
        // Group updates by tile to minimize IO
        // Key: "dim:zoom:x:z"
        const tasks = new Map<string, TileUpdateTask>();

        for (const chunk of chunks) {
            for (const zoom of ZOOM_LEVELS) {
                // Find which tile this chunk belongs to at this zoom level
                const { x: tileX, z: tileZ } = storage.blockToTile(chunk.chunkX * 16, chunk.chunkZ * 16, zoom);

                const key = `${chunk.dimension}:${zoom}:${tileX}:${tileZ}`;

                let task = tasks.get(key);
                if (!task) {
                    task = {
                        dimension: chunk.dimension,
                        zoom,
                        x: tileX,
                        z: tileZ,
                        blocks: [],
                    };
                    tasks.set(key, task);
                }

                // Add blocks to task
                task.blocks.push(...chunk.blocks);
            }
        }

        // execute tasks
        await this.processTasks(Array.from(tasks.values()));
    }

    /**
     * Process a batch of block updates
     *
     * Block updates don't include map color info, so we just invalidate the affected tiles.
     * The next chunk scan from the behavior pack will provide the updated data.
     */
    async processBlockUpdates(updates: BlockChange[]): Promise<void> {
        const storage = getTileStorageService();
        const tasks = new Map<string, TileInvalidationTask>();

        for (const update of updates) {
            for (const zoom of ZOOM_LEVELS) {
                const { x: tileX, z: tileZ } = storage.blockToTile(update.x, update.z, zoom);

                const key = `${update.dimension}:${zoom}:${tileX}:${tileZ}`;

                let task = tasks.get(key);
                if (!task) {
                    task = {
                        dimension: update.dimension,
                        zoom,
                        x: tileX,
                        z: tileZ,
                        blockUpdates: [],
                    };
                    tasks.set(key, task);
                }

                task.blockUpdates.push({
                    x: update.x,
                    y: update.y,
                    z: update.z,
                    type: update.blockType,
                });
            }
        }

        // For block updates, just invalidate the tiles so they get regenerated on next scan
        await this.processInvalidationTasks(Array.from(tasks.values()));
    }

    /**
     * Handle tile invalidation for block changes
     *
     * Note: We intentionally do NOT delete tiles here. When blocks change,
     * the behavior pack sends both:
     * 1. A block change event (which triggers this method)
     * 2. A small area scan with the updated block data (which triggers processChunks)
     *
     * If we deleted the tile here, the subsequent small area update would only
     * contain a few blocks (e.g., 3x3 area), resulting in a mostly-black tile.
     * Instead, we let the area update merge with the existing tile data.
     *
     * The tile will be properly updated by processChunks when the area scan arrives.
     */
    private async processInvalidationTasks(_tasks: TileInvalidationTask[]): Promise<void> {
        // No-op: tiles will be updated by the subsequent chunk/area data
        // that the behavior pack sends after block changes
    }

    /**
     * Acquire a lock for a specific tile, ensuring only one update runs at a time.
     * Returns a release function that must be called when the update is complete.
     *
     * This prevents race conditions where multiple concurrent updates to the same
     * zoomed-out tile could cause data loss (read-modify-write race).
     */
    private async acquireTileLock(lockKey: string): Promise<() => void> {
        // Wait for any existing lock to be released
        while (this.tileLocks.has(lockKey)) {
            await this.tileLocks.get(lockKey);
        }

        // Create a new lock with a resolver we control
        let releaseLock: () => void;
        const lockPromise = new Promise<void>(resolve => {
            releaseLock = resolve;
        });

        this.tileLocks.set(lockKey, lockPromise);

        // Return the release function
        return () => {
            this.tileLocks.delete(lockKey);
            releaseLock!();
        };
    }

    /**
     * Process a single tile update with proper locking.
     * Ensures the read-modify-write cycle is atomic per tile.
     */
    private async processSingleTileUpdate(
        dimension: Dimension,
        zoom: ZoomLevel,
        x: number,
        z: number,
        mapType: string,
        blocks: ChunkBlock[]
    ): Promise<TileCoordinates> {
        const storage = getTileStorageService();
        const generator = getTileGeneratorService();

        const lockKey = createTileLockKey(dimension, mapType, zoom, x, z);
        const releaseLock = await this.acquireTileLock(lockKey);

        try {
            // Read existing tile for this map type
            const existingBuffer = storage.readTile(dimension, zoom, x, z, mapType as 'block' | 'height');

            // Generate updated tile
            const newTileBuffer = await generator.generateTile(
                blocks,
                { dimension, zoom, x, z, mapType: mapType as 'block' | 'height' },
                existingBuffer ?? undefined,
                mapType as 'block' | 'height'
            );

            // Save tile
            storage.writeTile(dimension, zoom, x, z, newTileBuffer, mapType as 'block' | 'height');

            return { dimension, zoom, x, z, mapType: mapType as 'block' | 'height' };
        } finally {
            releaseLock();
        }
    }

    private async processTasks(tasks: TileUpdateTask[]): Promise<void> {
        const wsService = getWebSocketService();

        // Track updated tiles to emit WebSocket events
        const updatedTiles: TileCoordinates[] = [];

        // Process all tile updates with per-tile locking
        // Tasks can run concurrently as long as they target different tiles
        // The locking mechanism ensures same-tile updates are serialized
        const updatePromises: Promise<TileCoordinates>[] = [];

        for (const task of tasks) {
            const { dimension, zoom, x, z, blocks } = task;

            // Generate and save tiles for both map types
            for (const mapType of MAP_TYPES) {
                updatePromises.push(this.processSingleTileUpdate(dimension, zoom, x, z, mapType, blocks));
            }
        }

        // Wait for all updates to complete
        const results = await Promise.all(updatePromises);
        updatedTiles.push(...results);

        // Emit tile update events to WebSocket clients
        if (updatedTiles.length > 0) {
            wsService.emitTileUpdate(updatedTiles);
        }
    }
}

let _tileUpdateService: TileUpdateService | null = null;

export function getTileUpdateService(): TileUpdateService {
    if (!_tileUpdateService) {
        _tileUpdateService = new TileUpdateService();
    }
    return _tileUpdateService;
}
