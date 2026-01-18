import sharp from 'sharp';
import { TILE_SIZE, BLOCKS_PER_TILE } from '@minecarta/shared';
import type {
    ZoomLevel,
    TileCoordinates,
    ChunkBlockBase,
    ChunkBlockColorHeight,
    ChunkBlockDensity,
    RGBA,
    MapType,
} from '@minecarta/shared';
import { logWarning } from '../logging/index.js';

/**
 * Minecraft map shade multipliers.
 * These are applied based on the height difference between a block and the block to its north.
 *
 * From https://minecraft.wiki/w/Map_item_format:
 * - If current block is LOWER than the block to the north: multiply by 180/255 (darker)
 * - If current block is SAME height as the block to the north: multiply by 220/255 (normal)
 * - If current block is HIGHER than the block to the north: multiply by 255/255 (brighter)
 * - Fourth shade (135/255) is not used in natural generation
 */
const SHADE_MULTIPLIERS = {
    DARKER: 180 / 255, // Block is lower than north
    NORMAL: 220 / 255, // Block is same height as north
    BRIGHTER: 255 / 255, // Block is higher than north
} as const;

/**
 * Water depth ranges for the 5 shade levels.
 * From Minecraft wiki: water uses 5 distinct levels - 3 solid shades plus 2 checkerboard patterns.
 *
 * Depth ranges (based on Minecraft's algorithm):
 * - Level 0 (brightest): depth 1-2 blocks
 * - Level 1 (checker bright/normal): depth 3-4 blocks
 * - Level 2 (normal): depth 5-7 blocks
 * - Level 3 (checker normal/dark): depth 8-11 blocks
 * - Level 4 (darkest): depth 12+ blocks
 */
const WATER_DEPTH_LEVELS = {
    LEVEL_0_MAX: 2, // 1-2 blocks: brightest
    LEVEL_1_MAX: 4, // 3-4 blocks: checkerboard bright/normal
    LEVEL_2_MAX: 7, // 5-7 blocks: normal
    LEVEL_3_MAX: 11, // 8-11 blocks: checkerboard normal/dark
    // 12+ blocks: darkest
} as const;

/**
 * Height map configuration for grayscale rendering.
 *
 * The Y coordinate is mapped to a grayscale value:
 * - minY: The minimum Y value (maps to black, 0)
 * - maxY: The maximum Y value (maps to white, 255)
 *
 * Default values cover the full Minecraft world height range.
 * Overworld: -64 to 320
 * Nether: 0 to 128
 * The End: 0 to 256
 */
const HEIGHT_MAP_CONFIG = {
    minY: -64,
    maxY: 320,
} as const;

/**
 * Service for generating map tiles from block data
 */
export class TileGeneratorService {
    /**
     * Build a height map from blocks.
     * Maps (x, z) coordinates to Y height for quick lookups.
     *
     * @param blocks Array of blocks
     * @returns Map with key "x,z" and value being the Y height
     */
    private buildHeightMap(blocks: readonly ChunkBlockBase[]): Map<string, number> {
        const heightMap = new Map<string, number>();

        for (const block of blocks) {
            const key = `${block.x},${block.z}`;
            const existingHeight = heightMap.get(key);

            // Keep the highest Y value for each x,z coordinate
            if (existingHeight === undefined || block.y > existingHeight) {
                heightMap.set(key, block.y);
            }
        }

        return heightMap;
    }

    /**
     * Calculate the shade multiplier for a block based on Minecraft's map shading algorithm.
     * Compares the block's height to the block directly to the north (z - 1).
     *
     * @param block The block to calculate shade for
     * @param heightMap Height map for quick lookups
     * @returns Shade multiplier (0.71, 0.86, or 1.0)
     */
    private calculateShadeMultiplier(block: ChunkBlockColorHeight, heightMap: Map<string, number>): number {
        const currentHeight = block.y;
        const northKey = `${block.x},${block.z - 1}`;
        const northHeight = heightMap.get(northKey);

        // If there's no block to the north (edge of known area), use normal shade
        if (northHeight === undefined) {
            return SHADE_MULTIPLIERS.NORMAL;
        }

        if (currentHeight < northHeight) {
            return SHADE_MULTIPLIERS.DARKER;
        } else if (currentHeight > northHeight) {
            return SHADE_MULTIPLIERS.BRIGHTER;
        } else {
            return SHADE_MULTIPLIERS.NORMAL;
        }
    }

    /**
     * Calculate shade multiplier for water blocks based on depth.
     * Water uses 5 depth levels with checkerboard patterns for intermediate levels.
     *
     * From Minecraft wiki: "For water, the map conveys the depth to the first non-water
     * block beneath it. To represent this, the algorithm uses five distinct levels of
     * depth: the 3 shades, plus two intermediate checker patterns that alternate
     * between the two adjacent shades."
     *
     * @param block The water block
     * @returns Shade multiplier based on water depth and position
     */
    private calculateWaterShadeMultiplier(block: ChunkBlockColorHeight): number {
        const depth = block.waterDepth ?? 1;
        const isCheckerOdd = (block.x + block.z) % 2 === 1;

        if (depth <= WATER_DEPTH_LEVELS.LEVEL_0_MAX) {
            // Shallowest water: brightest shade
            return SHADE_MULTIPLIERS.BRIGHTER;
        } else if (depth <= WATER_DEPTH_LEVELS.LEVEL_1_MAX) {
            // Checkerboard between bright and normal
            return isCheckerOdd ? SHADE_MULTIPLIERS.BRIGHTER : SHADE_MULTIPLIERS.NORMAL;
        } else if (depth <= WATER_DEPTH_LEVELS.LEVEL_2_MAX) {
            // Medium depth: normal shade
            return SHADE_MULTIPLIERS.NORMAL;
        } else if (depth <= WATER_DEPTH_LEVELS.LEVEL_3_MAX) {
            // Checkerboard between normal and dark
            return isCheckerOdd ? SHADE_MULTIPLIERS.NORMAL : SHADE_MULTIPLIERS.DARKER;
        } else {
            // Deepest water: darkest shade
            return SHADE_MULTIPLIERS.DARKER;
        }
    }

    /**
     * Check if a block type is water
     */
    private isWaterBlock(block: ChunkBlockColorHeight): boolean {
        return block.waterDepth !== undefined && block.waterDepth > 0;
    }

    /**
     * Apply shade multiplier to a color.
     * Multiplies R, G, B components by the shade value.
     *
     * @param color Original color
     * @param shade Shade multiplier
     * @returns Shaded color
     */
    private applyShade(color: RGBA, shade: number): RGBA {
        return {
            r: Math.floor(color.r * shade),
            g: Math.floor(color.g * shade),
            b: Math.floor(color.b * shade),
            a: color.a,
        };
    }

    /**
     * Convert a Y coordinate to a grayscale value for height mapping.
     *
     * @param y The Y coordinate of the block
     * @returns Grayscale value (0-255)
     */
    private yToGrayscale(y: number): number {
        const { minY, maxY } = HEIGHT_MAP_CONFIG;
        // Clamp Y to the configured range
        const clampedY = Math.max(minY, Math.min(maxY, y));
        // Normalize to 0-1 range, then scale to 0-255
        const normalized = (clampedY - minY) / (maxY - minY);
        return Math.floor(normalized * 255);
    }

    /**
     * Convert a normalized density value (0-1) to a grayscale value.
     */
    private densityToGrayscale(density: number | undefined): number {
        const normalized = Math.max(0, Math.min(1, density ?? 0));
        return Math.floor(normalized * 255);
    }

    /**
     * Generate a PNG tile from block data.
     * Dispatches to the appropriate generator based on map type.
     *
     * @param blocks Array of blocks that fall within this tile's area
     * @param coords The coordinates of the tile being generated
     * @param baseImage Optional buffer of the existing tile image to update
     * @param mapType The type of map to generate ('block', 'height', or 'density')
     */
    async generateTile(
        blocks: ChunkBlockColorHeight[],
        coords: TileCoordinates,
        baseImage?: Buffer,
        mapType?: 'block' | 'height'
    ): Promise<Buffer>;
    async generateTile(
        blocks: ChunkBlockDensity[],
        coords: TileCoordinates,
        baseImage: Buffer | undefined,
        mapType: 'density'
    ): Promise<Buffer>;
    async generateTile(
        blocks: ChunkBlockColorHeight[] | ChunkBlockDensity[],
        coords: TileCoordinates,
        baseImage?: Buffer,
        mapType: MapType = 'block'
    ): Promise<Buffer> {
        if (mapType === 'height') {
            return this.generateHeightTile(blocks as ChunkBlockColorHeight[], coords, baseImage);
        }
        if (mapType === 'density') {
            return this.generateDensityTile(blocks as ChunkBlockDensity[], coords, baseImage);
        }
        return this.generateBlockTile(blocks as ChunkBlockColorHeight[], coords, baseImage);
    }

    /**
     * Generate a grayscale height map tile from block Y values.
     *
     * @param blocks Array of blocks that fall within this tile's area
     * @param coords The coordinates of the tile being generated
     * @param baseImage Optional buffer of the existing tile image to update
     */
    private async generateHeightTile(
        blocks: ChunkBlockColorHeight[],
        coords: TileCoordinates,
        baseImage?: Buffer
    ): Promise<Buffer> {
        const { zoom, x: tileX, z: tileZ } = coords;

        // Create pixel buffer (RGBA)
        let pixelData: Uint8ClampedArray;

        if (baseImage) {
            const { data, info } = await sharp(baseImage).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            if (info.width !== TILE_SIZE || info.height !== TILE_SIZE) {
                pixelData = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
                pixelData.fill(0);
            } else {
                pixelData = new Uint8ClampedArray(data);
            }
        } else {
            pixelData = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
            pixelData.fill(0);
        }

        const blockStartX = tileX * BLOCKS_PER_TILE[zoom as ZoomLevel];
        const blockStartZ = tileZ * BLOCKS_PER_TILE[zoom as ZoomLevel];

        const scale = BLOCKS_PER_TILE[zoom as ZoomLevel] / TILE_SIZE;
        const pixelsPerBlock = scale < 1 ? Math.round(1 / scale) : 1;

        // Build height map for this tile (x,z -> highest Y)
        const heightMap = this.buildHeightMap(blocks);

        for (const block of blocks) {
            const relX = block.x - blockStartX;
            const relZ = block.z - blockStartZ;

            if (
                relX < 0 ||
                relZ < 0 ||
                relX >= BLOCKS_PER_TILE[zoom as ZoomLevel] ||
                relZ >= BLOCKS_PER_TILE[zoom as ZoomLevel]
            ) {
                continue;
            }

            // Check if this is the highest block at this position
            const key = `${block.x},${block.z}`;
            const highestY = heightMap.get(key);
            if (highestY !== block.y) {
                continue; // Skip non-surface blocks for height map
            }

            // Convert Y to grayscale
            const gray = this.yToGrayscale(block.y);

            if (scale >= 1) {
                const px = Math.floor(relX / scale);
                const py = Math.floor(relZ / scale);
                const idx = (py * TILE_SIZE + px) * 4;

                pixelData[idx] = gray;
                pixelData[idx + 1] = gray;
                pixelData[idx + 2] = gray;
                pixelData[idx + 3] = 255;
            } else {
                const startPx = relX * pixelsPerBlock;
                const startPy = relZ * pixelsPerBlock;

                for (let dy = 0; dy < pixelsPerBlock; dy++) {
                    for (let dx = 0; dx < pixelsPerBlock; dx++) {
                        const px = startPx + dx;
                        const py = startPy + dy;

                        if (px >= TILE_SIZE || py >= TILE_SIZE) continue;

                        const idx = (py * TILE_SIZE + px) * 4;

                        pixelData[idx] = gray;
                        pixelData[idx + 1] = gray;
                        pixelData[idx + 2] = gray;
                        pixelData[idx + 3] = 255;
                    }
                }
            }
        }

        return sharp(pixelData, {
            raw: {
                width: TILE_SIZE,
                height: TILE_SIZE,
                channels: 4,
            },
        })
            .png()
            .toBuffer();
    }

    /**
     * Generate a grayscale density map tile from normalized Y-column density values.
     *
     * @param blocks Array of blocks that fall within this tile's area
     * @param coords The coordinates of the tile being generated
     * @param baseImage Optional buffer of the existing tile image to update
     */
    private async generateDensityTile(
        blocks: ChunkBlockDensity[],
        coords: TileCoordinates,
        baseImage?: Buffer
    ): Promise<Buffer> {
        const { zoom, x: tileX, z: tileZ } = coords;

        let pixelData: Uint8ClampedArray;

        if (baseImage) {
            const { data, info } = await sharp(baseImage).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            if (info.width !== TILE_SIZE || info.height !== TILE_SIZE) {
                pixelData = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
                pixelData.fill(0);
            } else {
                pixelData = new Uint8ClampedArray(data);
            }
        } else {
            pixelData = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
            pixelData.fill(0);
        }

        const blockStartX = tileX * BLOCKS_PER_TILE[zoom as ZoomLevel];
        const blockStartZ = tileZ * BLOCKS_PER_TILE[zoom as ZoomLevel];

        const scale = BLOCKS_PER_TILE[zoom as ZoomLevel] / TILE_SIZE;
        const pixelsPerBlock = scale < 1 ? Math.round(1 / scale) : 1;

        const heightMap = this.buildHeightMap(blocks);

        for (const block of blocks) {
            const relX = block.x - blockStartX;
            const relZ = block.z - blockStartZ;

            if (
                relX < 0 ||
                relZ < 0 ||
                relX >= BLOCKS_PER_TILE[zoom as ZoomLevel] ||
                relZ >= BLOCKS_PER_TILE[zoom as ZoomLevel]
            ) {
                continue;
            }

            const key = `${block.x},${block.z}`;
            const highestY = heightMap.get(key);
            if (highestY !== block.y) {
                continue;
            }

            const gray = this.densityToGrayscale(block.density);

            if (scale >= 1) {
                const px = Math.floor(relX / scale);
                const py = Math.floor(relZ / scale);
                const idx = (py * TILE_SIZE + px) * 4;

                pixelData[idx] = gray;
                pixelData[idx + 1] = gray;
                pixelData[idx + 2] = gray;
                pixelData[idx + 3] = 255;
            } else {
                const startPx = relX * pixelsPerBlock;
                const startPy = relZ * pixelsPerBlock;

                for (let dy = 0; dy < pixelsPerBlock; dy++) {
                    for (let dx = 0; dx < pixelsPerBlock; dx++) {
                        const px = startPx + dx;
                        const py = startPy + dy;

                        if (px >= TILE_SIZE || py >= TILE_SIZE) continue;

                        const idx = (py * TILE_SIZE + px) * 4;

                        pixelData[idx] = gray;
                        pixelData[idx + 1] = gray;
                        pixelData[idx + 2] = gray;
                        pixelData[idx + 3] = 255;
                    }
                }
            }
        }

        return sharp(pixelData, {
            raw: {
                width: TILE_SIZE,
                height: TILE_SIZE,
                channels: 4,
            },
        })
            .png()
            .toBuffer();
    }

    /**
     * Generate a standard block-color PNG tile from block data
     *
     * @param blocks Array of blocks that fall within this tile's area
     * @param coords The coordinates of the tile being generated
     * @param baseImage Optional buffer of the existing tile image to update
     */
    private async generateBlockTile(
        blocks: ChunkBlockColorHeight[],
        coords: TileCoordinates,
        baseImage?: Buffer
    ): Promise<Buffer> {
        const { zoom, x: tileX, z: tileZ } = coords;

        // Create distinct pixel buffer (RGBA)
        let pixelData: Uint8ClampedArray;

        if (baseImage) {
            // If we have a base image, load it and get raw pixel data
            const { data, info } = await sharp(baseImage).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            if (info.width !== TILE_SIZE || info.height !== TILE_SIZE) {
                // Warning: dimension mismatch, falling back to empty
                pixelData = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
                pixelData.fill(0);
            } else {
                pixelData = new Uint8ClampedArray(data);
            }
        } else {
            // Initialize with transparent black
            pixelData = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
            pixelData.fill(0);
        }

        const blockStartX = tileX * BLOCKS_PER_TILE[zoom as ZoomLevel];
        const blockStartZ = tileZ * BLOCKS_PER_TILE[zoom as ZoomLevel];

        // Scale factor: blocks per pixel
        // At zoom 0: 16 blocks / 256 pixels = 0.0625 blocks per pixel (16x16 pixels per block)
        // At zoom 4: 256 blocks / 256 pixels = 1 block per pixel
        // At zoom 7: 2048 blocks / 256 pixels = 8 blocks per pixel
        const scale = BLOCKS_PER_TILE[zoom as ZoomLevel] / TILE_SIZE;

        // Pixels per block (inverse of scale, used when scale < 1)
        const pixelsPerBlock = scale < 1 ? Math.round(1 / scale) : 1;

        // Build height map for Minecraft-style shading
        // The shade of each block depends on its height relative to the block to the north
        const heightMap = this.buildHeightMap(blocks);

        // We process blocks and draw them to the buffer
        for (const block of blocks) {
            // Calculate relative position within the tile
            const relX = block.x - blockStartX;
            const relZ = block.z - blockStartZ;

            // Skip if outside tile bounds
            if (
                relX < 0 ||
                relZ < 0 ||
                relX >= BLOCKS_PER_TILE[zoom as ZoomLevel] ||
                relZ >= BLOCKS_PER_TILE[zoom as ZoomLevel]
            ) {
                continue;
            }

            // Use mapColor from block data if provided, otherwise fall back to lookup
            const baseColor = block.mapColor;
            if (baseColor == null) {
                logWarning(
                    'TileGenerator',
                    `Missing map color for block at (${block.x}, ${block.z}) of type ${block.type}`
                );
                continue;
            }

            // Apply shading based on block type
            // Water uses depth-based checkerboard shading
            // Other blocks use height-based terrain shading
            const shadeMultiplier = this.isWaterBlock(block)
                ? this.calculateWaterShadeMultiplier(block)
                : this.calculateShadeMultiplier(block, heightMap);
            const color = this.applyShade(baseColor, shadeMultiplier);

            if (scale >= 1) {
                // Multiple blocks per pixel - draw single pixel
                const px = Math.floor(relX / scale);
                const py = Math.floor(relZ / scale); // Z maps to Y in image space

                // Calculate buffer index
                const idx = (py * TILE_SIZE + px) * 4;

                // Simple overwrite (no blending yet)
                pixelData[idx] = color.r;
                pixelData[idx + 1] = color.g;
                pixelData[idx + 2] = color.b;
                pixelData[idx + 3] = 255; // Hard code to fully opaque for now
            } else {
                // Each block is multiple pixels - draw a square
                const startPx = relX * pixelsPerBlock;
                const startPy = relZ * pixelsPerBlock; // Z maps to Y in image space

                // Draw a pixelsPerBlock x pixelsPerBlock square for each block
                for (let dy = 0; dy < pixelsPerBlock; dy++) {
                    for (let dx = 0; dx < pixelsPerBlock; dx++) {
                        const px = startPx + dx;
                        const py = startPy + dy;

                        // Safety check (should not be needed if math is correct)
                        if (px >= TILE_SIZE || py >= TILE_SIZE) continue;

                        const idx = (py * TILE_SIZE + px) * 4;

                        pixelData[idx] = color.r;
                        pixelData[idx + 1] = color.g;
                        pixelData[idx + 2] = color.b;
                        pixelData[idx + 3] = 255; // Hard code to fully opaque for now
                    }
                }
            }
        }

        // Generate PNG using Sharp
        return sharp(pixelData, {
            raw: {
                width: TILE_SIZE,
                height: TILE_SIZE,
                channels: 4,
            },
        })
            .png()
            .toBuffer();
    }

    /**
     * Generate a parent tile by compositing 4 child tiles (pyramid generation).
     * The parent tile at (x, z) in zoom level N is composed of children at zoom level N-1:
     *   - Top-left:     (2*x,   2*z)
     *   - Top-right:    (2*x+1, 2*z)
     *   - Bottom-left:  (2*x,   2*z+1)
     *   - Bottom-right: (2*x+1, 2*z+1)
     *
     * Each child tile is scaled to half size (128x128) and placed in the corresponding quadrant.
     *
     * @param childTiles Array of 4 child tile buffers [topLeft, topRight, bottomLeft, bottomRight]
     *                   Can contain null for missing tiles (those quadrants will be transparent)
     * @returns The composited parent tile as a PNG buffer
     */
    async compositeChildTiles(childTiles: (Buffer | null)[]): Promise<Buffer> {
        const halfSize = TILE_SIZE / 2; // 128

        // Create base transparent image
        let composite = sharp({
            create: {
                width: TILE_SIZE,
                height: TILE_SIZE,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        });

        // Build composite inputs for each quadrant
        const compositeInputs: sharp.OverlayOptions[] = [];

        // Positions for each quadrant: [topLeft, topRight, bottomLeft, bottomRight]
        const positions: Array<{ left: number; top: number }> = [
            { left: 0, top: 0 }, // Top-left
            { left: halfSize, top: 0 }, // Top-right
            { left: 0, top: halfSize }, // Bottom-left
            { left: halfSize, top: halfSize }, // Bottom-right
        ];

        for (let i = 0; i < 4; i++) {
            const childBuffer = childTiles[i];
            if (childBuffer) {
                // Resize child tile to half size
                const resized = await sharp(childBuffer).resize(halfSize, halfSize).toBuffer();

                compositeInputs.push({
                    input: resized,
                    left: positions[i].left,
                    top: positions[i].top,
                });
            }
        }

        // If we have any tiles to composite, do it
        if (compositeInputs.length > 0) {
            composite = composite.composite(compositeInputs);
        }

        return composite.png().toBuffer();
    }
}

// Singleton instance
let _tileGeneratorService: TileGeneratorService | null = null;

export function getTileGeneratorService(): TileGeneratorService {
    if (!_tileGeneratorService) {
        _tileGeneratorService = new TileGeneratorService();
    }
    return _tileGeneratorService;
}
