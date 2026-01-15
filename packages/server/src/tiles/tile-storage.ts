import * as fs from 'node:fs';
import * as path from 'node:path';
import { DIMENSIONS, ZOOM_LEVELS, BLOCKS_PER_TILE, MAP_TYPES } from '@minecraft-map/shared';
import type { Dimension, ZoomLevel, MapType } from '@minecraft-map/shared';
import { getConfig } from '../config/index.js';

/**
 * Tile storage service
 *
 * Manages the file-based tile storage directory structure.
 * Directory structure: tiles/<dimension>/<mapType>/<zoom>/<x>/<z>.png
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

            // Create map type directories
            for (const mapType of MAP_TYPES) {
                const mapTypeDir = path.join(dimensionDir, mapType);
                if (!fs.existsSync(mapTypeDir)) {
                    fs.mkdirSync(mapTypeDir, { recursive: true });
                }

                // Create zoom level directories
                for (const zoom of ZOOM_LEVELS) {
                    const zoomDir = path.join(mapTypeDir, String(zoom));
                    if (!fs.existsSync(zoomDir)) {
                        fs.mkdirSync(zoomDir, { recursive: true });
                    }
                }
            }
        }
    }

    /**
     * Get the path for a specific tile
     */
    getTilePath(dimension: Dimension, zoom: ZoomLevel, x: number, z: number, mapType: MapType = 'block'): string {
        return path.join(this.baseDir, dimension, mapType, String(zoom), String(x), `${z}.png`);
    }

    /**
     * Check if a tile exists
     */
    tileExists(dimension: Dimension, zoom: ZoomLevel, x: number, z: number, mapType: MapType = 'block'): boolean {
        return fs.existsSync(this.getTilePath(dimension, zoom, x, z, mapType));
    }

    /**
     * Read a tile from storage
     */
    readTile(dimension: Dimension, zoom: ZoomLevel, x: number, z: number, mapType: MapType = 'block'): Buffer | null {
        const tilePath = this.getTilePath(dimension, zoom, x, z, mapType);
        if (!fs.existsSync(tilePath)) {
            return null;
        }
        return fs.readFileSync(tilePath);
    }

    /**
     * Write a tile to storage
     */
    writeTile(
        dimension: Dimension,
        zoom: ZoomLevel,
        x: number,
        z: number,
        data: Buffer,
        mapType: MapType = 'block'
    ): void {
        const tilePath = this.getTilePath(dimension, zoom, x, z, mapType);
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
    deleteTile(dimension: Dimension, zoom: ZoomLevel, x: number, z: number, mapType: MapType = 'block'): boolean {
        const tilePath = this.getTilePath(dimension, zoom, x, z, mapType);
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
        // Delete tiles at all zoom levels that contain this block (for all map types)
        for (const zoom of ZOOM_LEVELS) {
            const { x, z } = this.blockToTile(blockX, blockZ, zoom);
            for (const mapType of MAP_TYPES) {
                this.deleteTile(dimension, zoom, x, z, mapType);
            }
        }
    }

    /**
     * Clear all tiles from storage
     * Removes all tile files and recreates the directory structure
     */
    clearAllTiles(): void {
        // Remove entire tiles directory
        if (fs.existsSync(this.baseDir)) {
            fs.rmSync(this.baseDir, { recursive: true, force: true });
        }
        // Recreate directory structure
        this.initialize();
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
