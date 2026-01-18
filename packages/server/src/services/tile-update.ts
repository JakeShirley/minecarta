import type {
    ChunkData,
    ChunkBlockColorHeight,
    ChunkBlockDensity,
    BlockChange,
    Dimension,
    ZoomLevel,
    TileCoordinates,
    MapType,
} from '@minecarta/shared';
import { ZOOM_LEVELS } from '@minecarta/shared';
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

interface TileUpdateTaskBase<TBlock> {
    dimension: Dimension;
    zoom: ZoomLevel;
    x: number;
    z: number;
    blocks: TBlock[];
}

type ColorHeightTileUpdateTask = TileUpdateTaskBase<ChunkBlockColorHeight>;
type DensityTileUpdateTask = TileUpdateTaskBase<ChunkBlockDensity>;

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
function createTileLockKey(dimension: Dimension, mapType: MapType, zoom: ZoomLevel, x: number, z: number): string {
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
     * Process a batch of chunks and update tiles.
     *
     * This uses a pyramid approach:
     * 1. Generate/update zoom level 0 tiles from block data
     * 2. Regenerate parent tiles (zoom 1+) by compositing child tiles
     */
    async processChunks(chunks: ChunkData[]): Promise<void> {
        const storage = getTileStorageService();
        // Group updates by tile at ZOOM LEVEL 0 ONLY
        // Key: "dim:0:x:z"
        const colorHeightTasks = new Map<string, ColorHeightTileUpdateTask>();
        const densityTasks = new Map<string, DensityTileUpdateTask>();

        for (const chunk of chunks) {
            // Only process at zoom level 0 - parent tiles will be composited
            const zoom = 0 as ZoomLevel;
            const { x: tileX, z: tileZ } = storage.blockToTile(chunk.chunkX * 16, chunk.chunkZ * 16, zoom);

            const key = `${chunk.dimension}:${zoom}:${tileX}:${tileZ}`;
            if (chunk.kind === 'color-height') {
                let task = colorHeightTasks.get(key);
                if (!task) {
                    task = {
                        dimension: chunk.dimension,
                        zoom,
                        x: tileX,
                        z: tileZ,
                        blocks: [],
                    };
                    colorHeightTasks.set(key, task);
                }

                task.blocks.push(...chunk.blocks);
            } else {
                let task = densityTasks.get(key);
                if (!task) {
                    task = {
                        dimension: chunk.dimension,
                        zoom,
                        x: tileX,
                        z: tileZ,
                        blocks: [],
                    };
                    densityTasks.set(key, task);
                }

                task.blocks.push(...chunk.blocks);
            }
        }

        // Execute zoom 0 tasks and collect affected tiles for pyramid regeneration
        const updatedColorHeightTiles = await this.processZoom0Tasks(Array.from(colorHeightTasks.values()), [
            'block',
            'height',
        ]);
        const updatedDensityTiles = await this.processZoom0Tasks(Array.from(densityTasks.values()), ['density']);
        const updatedZoom0Tiles = [...updatedColorHeightTiles, ...updatedDensityTiles];

        // Regenerate parent tiles (zoom 1+) using pyramid compositing
        await this.regenerateParentTiles(updatedZoom0Tiles);
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
        mapType: 'density',
        blocks: ChunkBlockDensity[]
    ): Promise<TileCoordinates>;
    private async processSingleTileUpdate(
        dimension: Dimension,
        zoom: ZoomLevel,
        x: number,
        z: number,
        mapType: 'block' | 'height',
        blocks: ChunkBlockColorHeight[]
    ): Promise<TileCoordinates>;
    private async processSingleTileUpdate(
        dimension: Dimension,
        zoom: ZoomLevel,
        x: number,
        z: number,
        mapType: MapType,
        blocks: ChunkBlockColorHeight[] | ChunkBlockDensity[]
    ): Promise<TileCoordinates> {
        const storage = getTileStorageService();
        const generator = getTileGeneratorService();

        const lockKey = createTileLockKey(dimension, mapType, zoom, x, z);
        const releaseLock = await this.acquireTileLock(lockKey);

        try {
            // Read existing tile for this map type
            const existingBuffer = storage.readTile(dimension, zoom, x, z, mapType);

            // Generate updated tile
            const newTileBuffer =
                mapType === 'density'
                    ? await generator.generateTile(
                          blocks as ChunkBlockDensity[],
                          { dimension, zoom, x, z, mapType },
                          existingBuffer ?? undefined,
                          mapType
                      )
                    : await generator.generateTile(
                          blocks as ChunkBlockColorHeight[],
                          { dimension, zoom, x, z, mapType },
                          existingBuffer ?? undefined,
                          mapType
                      );

            // Save tile
            storage.writeTile(dimension, zoom, x, z, newTileBuffer, mapType);

            return { dimension, zoom, x, z, mapType };
        } finally {
            releaseLock();
        }
    }

    private async processZoom0Tasks<TBlock>(
        tasks: TileUpdateTaskBase<TBlock>[],
        mapTypes: readonly MapType[]
    ): Promise<TileCoordinates[]> {
        // Track updated tiles for pyramid regeneration
        const updatedTiles: TileCoordinates[] = [];

        // Process all tile updates with per-tile locking
        // Tasks can run concurrently as long as they target different tiles
        // The locking mechanism ensures same-tile updates are serialized
        const updatePromises: Promise<TileCoordinates>[] = [];

        for (const task of tasks) {
            const { dimension, zoom, x, z, blocks } = task;

            for (const mapType of mapTypes) {
                if (mapType === 'density') {
                    updatePromises.push(
                        this.processSingleTileUpdate(dimension, zoom, x, z, mapType, blocks as ChunkBlockDensity[])
                    );
                } else {
                    updatePromises.push(
                        this.processSingleTileUpdate(dimension, zoom, x, z, mapType, blocks as ChunkBlockColorHeight[])
                    );
                }
            }
        }

        // Wait for all updates to complete
        const results = await Promise.all(updatePromises);
        updatedTiles.push(...results);

        return updatedTiles;
    }

    /**
     * Regenerate parent tiles (zoom 1+) using pyramid compositing.
     * For each updated zoom 0 tile, regenerates all ancestor tiles up the pyramid.
     */
    private async regenerateParentTiles(updatedZoom0Tiles: TileCoordinates[]): Promise<void> {
        const storage = getTileStorageService();
        const generator = getTileGeneratorService();
        const wsService = getWebSocketService();

        // Track all updated tiles for WebSocket notification
        const allUpdatedTiles: TileCoordinates[] = [...updatedZoom0Tiles];

        // Group by dimension and map type to process efficiently
        const tilesByDimAndType = new Map<string, Set<string>>();

        for (const tile of updatedZoom0Tiles) {
            const key = `${tile.dimension}:${tile.mapType}`;
            if (!tilesByDimAndType.has(key)) {
                tilesByDimAndType.set(key, new Set());
            }
            tilesByDimAndType.get(key)!.add(`${tile.x}:${tile.z}`);
        }

        // For each dimension/mapType combination
        for (const [dimTypeKey, zoom0TileSet] of tilesByDimAndType) {
            const [dimension, mapType] = dimTypeKey.split(':') as [Dimension, MapType];

            // Track which parent tiles need regeneration at each zoom level
            let currentLevelTiles = new Set<string>();

            // Convert zoom 0 tiles to their parent coordinates at zoom 1
            for (const tileKey of zoom0TileSet) {
                const [x, z] = tileKey.split(':').map(Number);
                // Parent tile coordinates: divide by 2 and floor
                const parentX = Math.floor(x / 2);
                const parentZ = Math.floor(z / 2);
                currentLevelTiles.add(`${parentX}:${parentZ}`);
            }

            // Iterate through zoom levels 1 to 7
            for (let zoom = 1; zoom <= 7; zoom++) {
                const nextLevelTiles = new Set<string>();

                // Process each tile that needs regeneration at this level
                for (const tileKey of currentLevelTiles) {
                    const [x, z] = tileKey.split(':').map(Number);

                    // Get the 4 child tiles from the previous zoom level
                    const childZoom = (zoom - 1) as ZoomLevel;
                    const childTiles: (Buffer | null)[] = [
                        storage.readTile(dimension, childZoom, x * 2, z * 2, mapType), // Top-left
                        storage.readTile(dimension, childZoom, x * 2 + 1, z * 2, mapType), // Top-right
                        storage.readTile(dimension, childZoom, x * 2, z * 2 + 1, mapType), // Bottom-left
                        storage.readTile(dimension, childZoom, x * 2 + 1, z * 2 + 1, mapType), // Bottom-right
                    ];

                    // Only regenerate if at least one child exists
                    if (childTiles.some(t => t !== null)) {
                        const lockKey = createTileLockKey(dimension, mapType, zoom as ZoomLevel, x, z);
                        const releaseLock = await this.acquireTileLock(lockKey);

                        try {
                            const compositedTile = await generator.compositeChildTiles(childTiles);
                            storage.writeTile(dimension, zoom as ZoomLevel, x, z, compositedTile, mapType);

                            allUpdatedTiles.push({
                                dimension,
                                zoom: zoom as ZoomLevel,
                                x,
                                z,
                                mapType,
                            });
                        } finally {
                            releaseLock();
                        }
                    }

                    // Add this tile's parent to the next level
                    const parentX = Math.floor(x / 2);
                    const parentZ = Math.floor(z / 2);
                    nextLevelTiles.add(`${parentX}:${parentZ}`);
                }

                currentLevelTiles = nextLevelTiles;
            }
        }

        // Emit tile update events to WebSocket clients
        if (allUpdatedTiles.length > 0) {
            wsService.emitTileUpdate(allUpdatedTiles);
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
