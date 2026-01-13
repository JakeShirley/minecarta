import type { ChunkData, ChunkBlock, BlockChange, Dimension, ZoomLevel } from '@minecraft-map/shared';
import { ZOOM_LEVELS } from '@minecraft-map/shared';
import { getTileStorageService } from '../tiles/tile-storage.js';
import { getTileGeneratorService } from '../tiles/tile-generator.js';

interface TileUpdateTask {
  dimension: Dimension;
  zoom: ZoomLevel;
  x: number;
  z: number;
  blocks: ChunkBlock[];
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
            blocks: []
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
   */
  async processBlockUpdates(updates: BlockChange[]): Promise<void> {
    const storage = getTileStorageService();
    const tasks = new Map<string, TileUpdateTask>();

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
             blocks: []
           };
           tasks.set(key, task);
         }
         
         task.blocks.push({
           x: update.x,
           y: update.y,
           z: update.z,
           type: update.blockType
         });
      }
    }
    
    await this.processTasks(Array.from(tasks.values()));
  }

  private async processTasks(tasks: TileUpdateTask[]): Promise<void> {
    const storage = getTileStorageService();
    const generator = getTileGeneratorService();

    // Process sequentially for now to avoid race conditions on same file
    // (Though map splitting handles most contentions)
    for (const task of tasks) {
      const { dimension, zoom, x, z, blocks } = task;
      
      // Read existing tile
      const existingBuffer = storage.readTile(dimension, zoom, x, z);
      
      // Generate updated tile
      const newTileBuffer = await generator.generateTile(
        blocks,
        { dimension, zoom, x, z },
        existingBuffer ?? undefined
      );
      
      // Save tile
      storage.writeTile(dimension, zoom, x, z, newTileBuffer);
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
