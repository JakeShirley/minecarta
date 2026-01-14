import * as fs from 'node:fs';
import * as path from 'node:path';
import { DIMENSIONS, ZOOM_LEVELS, BLOCKS_PER_TILE } from '@minecraft-map/shared';
import type { Dimension, ZoomLevel } from '@minecraft-map/shared';
import { getConfig } from '../config/index.js';

/**
 * Tile storage service
 *
 * Manages the file-based tile storage directory structure
 */
export class TileStorageService {
  private readonly baseDir: string;

  constructor(dataDir?: string) {
    const config = getConfig();
    this.baseDir = path.join(dataDir ?? config.dataDir, 'tiles');
  }

  /**
   * Initialize the tile storage directory structure
   */
  initialize(): void {
    // Create base tiles directory
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    // Create dimension directories
    for (const dimension of DIMENSIONS) {
      const dimensionDir = path.join(this.baseDir, dimension);
      if (!fs.existsSync(dimensionDir)) {
        fs.mkdirSync(dimensionDir, { recursive: true });
      }

      // Create zoom level directories
      for (const zoom of ZOOM_LEVELS) {
        const zoomDir = path.join(dimensionDir, String(zoom));
        if (!fs.existsSync(zoomDir)) {
          fs.mkdirSync(zoomDir, { recursive: true });
        }
      }
    }
  }

  /**
   * Get the path for a specific tile
   */
  getTilePath(dimension: Dimension, zoom: ZoomLevel, x: number, z: number): string {
    return path.join(this.baseDir, dimension, String(zoom), String(x), `${z}.png`);
  }

  /**
   * Check if a tile exists
   */
  tileExists(dimension: Dimension, zoom: ZoomLevel, x: number, z: number): boolean {
    return fs.existsSync(this.getTilePath(dimension, zoom, x, z));
  }

  /**
   * Read a tile from storage
   */
  readTile(dimension: Dimension, zoom: ZoomLevel, x: number, z: number): Buffer | null {
    const tilePath = this.getTilePath(dimension, zoom, x, z);
    if (!fs.existsSync(tilePath)) {
      return null;
    }
    return fs.readFileSync(tilePath);
  }

  /**
   * Write a tile to storage
   */
  writeTile(dimension: Dimension, zoom: ZoomLevel, x: number, z: number, data: Buffer): void {
    const tilePath = this.getTilePath(dimension, zoom, x, z);
    const tileDir = path.dirname(tilePath);

    // Ensure directory exists
    if (!fs.existsSync(tileDir)) {
      fs.mkdirSync(tileDir, { recursive: true });
    }

    fs.writeFileSync(tilePath, data);
  }

  /**
   * Delete a tile from storage
   */
  deleteTile(dimension: Dimension, zoom: ZoomLevel, x: number, z: number): boolean {
    const tilePath = this.getTilePath(dimension, zoom, x, z);
    if (fs.existsSync(tilePath)) {
      fs.unlinkSync(tilePath);
      return true;
    }
    return false;
  }

  /**
   * Invalidate tiles affected by a block change at a position
   */
  invalidateTilesAt(dimension: Dimension, blockX: number, blockZ: number): void {
    // Delete tiles at all zoom levels that contain this block
    for (const zoom of ZOOM_LEVELS) {
      const { x, z } = this.blockToTile(blockX, blockZ, zoom);
      this.deleteTile(dimension, zoom, x, z);
    }
  }

  /**
   * Convert block coordinates to tile coordinates at a specific zoom level
   */
  blockToTile(blockX: number, blockZ: number, zoom: ZoomLevel): { x: number; z: number } {
    const blocksPerTile = BLOCKS_PER_TILE[zoom];
    return {
      x: Math.floor(blockX / blocksPerTile),
      z: Math.floor(blockZ / blocksPerTile),
    };
  }
}

// Singleton instance
let _tileStorageService: TileStorageService | null = null;

export function getTileStorageService(): TileStorageService {
  if (!_tileStorageService) {
    _tileStorageService = new TileStorageService();
  }
  return _tileStorageService;
}
