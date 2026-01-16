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

export class TileUpdateService {
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

    private async processTasks(tasks: TileUpdateTask[]): Promise<void> {
        const storage = getTileStorageService();
        const generator = getTileGeneratorService();
        const wsService = getWebSocketService();

        // Track updated tiles to emit WebSocket events
        const updatedTiles: TileCoordinates[] = [];

        // Process sequentially for now to avoid race conditions on same file
        // (Though map splitting handles most contentions)
        for (const task of tasks) {
            const { dimension, zoom, x, z, blocks } = task;

            // Generate and save tiles for both map types
            for (const mapType of MAP_TYPES) {
                // Read existing tile for this map type
                const existingBuffer = storage.readTile(dimension, zoom, x, z, mapType);

                // Generate updated tile
                const newTileBuffer = await generator.generateTile(
                    blocks,
                    { dimension, zoom, x, z, mapType },
                    existingBuffer ?? undefined,
                    mapType
                );

                // Save tile
                storage.writeTile(dimension, zoom, x, z, newTileBuffer, mapType);

                // Track for WebSocket notification
                updatedTiles.push({ dimension, zoom, x, z, mapType });
            }
        }

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

