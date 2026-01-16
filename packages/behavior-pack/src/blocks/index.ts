/**
 * Centralized block scanning and color utilities
 *
 * This module provides unified functions for ray casting, block color extraction,
 * and chunk scanning operations used throughout the behavior pack.
 */

import { BlockMapColorComponent, TintMethod } from '@minecraft/server';
import type { Dimension as MinecraftDimension, Block, RGBA } from '@minecraft/server';
import type { Dimension } from '@minecarta/shared';
import type { MinecraftChunkBlock, MinecraftChunkData } from '../types';
import { logDebug } from '../logging';

/**
 * Default color returned when block color cannot be determined
 */
const DEFAULT_BLOCK_COLOR: RGBA = { red: 0, green: 0, blue: 0, alpha: 0 };

/**
 * Logging tag for this module
 */
const LOG_TAG = 'Blocks';

/**
 * Convert Minecraft dimension ID to our Dimension type
 *
 * @param dimensionId - The Minecraft dimension ID (e.g., 'minecraft:overworld')
 * @returns Normalized dimension type
 */
export function toDimension(dimensionId: string): Dimension {
    switch (dimensionId) {
        case 'minecraft:overworld':
        case 'overworld':
            return 'overworld';
        case 'minecraft:nether':
        case 'nether':
            return 'nether';
        case 'minecraft:the_end':
        case 'the_end':
            return 'the_end';
        default:
            return 'overworld';
    }
}

/**
 * Get the maximum build height for a dimension
 *
 * @param dimensionId - The Minecraft dimension ID
 * @returns Maximum Y coordinate for the dimension
 */
export function getMaxHeight(dimensionId: string): number {
    switch (dimensionId) {
        case 'minecraft:nether':
        case 'nether':
            return 127;
        case 'minecraft:the_end':
        case 'the_end':
            return 256;
        default:
            return 320; // Overworld
    }
}

/**
 * Calculate chunk coordinates from world coordinates
 *
 * @param x - World X coordinate
 * @param z - World Z coordinate
 * @returns Chunk coordinates (chunkX, chunkZ)
 */
export function getChunkCoordinates(x: number, z: number): { chunkX: number; chunkZ: number } {
    return {
        chunkX: Math.floor(x / 16),
        chunkZ: Math.floor(z / 16),
    };
}

/**
 * Get the map color for a block, if available
 *
 * @param block - The Minecraft block to get color from
 * @returns RGBA color value, or null if the block has no map color
 */
export function getBlockMapColor(block: Block): RGBA | undefined {
    const resultColor = block.getMapColor();

    // No valid map color
    if (resultColor.red === 0 && resultColor.green === 0 && resultColor.blue === 0 && resultColor.alpha === 0) {
        return undefined;
    }
    return resultColor;
}

/**
 * Get the minimum build height for a dimension
 *
 * @param dimensionId - The Minecraft dimension ID
 * @returns Minimum Y coordinate for the dimension
 */
export function getMinHeight(dimensionId: string): number {
    switch (dimensionId) {
        case 'minecraft:nether':
        case 'nether':
            return 0;
        case 'minecraft:the_end':
        case 'the_end':
            return 0;
        default:
            return -64; // Overworld
    }
}

/**
 * Options for ray casting to find surface blocks
 */
export interface RaycastOptions {
    /** Include liquid blocks like water and lava (default: true) */
    readonly includeLiquidBlocks?: boolean;
    /** Include passable blocks like tall grass (default: true) */
    readonly includePassableBlocks?: boolean;
}

/**
 * Strategy for finding the starting Y position for surface scanning.
 * Different dimensions may need different approaches.
 */
export enum ScanStartStrategy {
    /** Start scanning from the maximum build height (standard top-down) */
    FromMaxHeight = 'FromMaxHeight',
    /** Find the first air block from top before scanning (for Nether ceiling) */
    FromFirstAir = 'FromFirstAir',
}

/**
 * Get the scan start strategy for a dimension.
 * - Nether uses FromFirstAir to skip the bedrock ceiling
 * - Other dimensions use FromMaxHeight for standard top-down scanning
 *
 * @param dimensionId - The Minecraft dimension ID
 * @returns The scan start strategy to use
 */
export function getScanStrategy(dimensionId: string): ScanStartStrategy {
    if (dimensionId.includes('nether')) {
        return ScanStartStrategy.FromFirstAir;
    }

    return ScanStartStrategy.FromMaxHeight;
}

/**
 * Check if a block is considered "air" or empty for scanning purposes.
 * This includes air, cave_air, and void_air.
 *
 * @param typeId - The block type ID
 * @returns True if the block is considered air
 */
function isAirBlock(typeId: string | undefined): boolean {
    if (!typeId) return true;
    return typeId.includes('air');
}

/**
 * Find the starting Y position for scanning in the Nether.
 * Walks down from max height until it finds the first air block,
 * which should be below the bedrock ceiling.
 *
 * @param dimension - The Minecraft dimension
 * @param worldX - World X coordinate
 * @param worldZ - World Z coordinate
 * @param maxHeight - Maximum height to start from
 * @param minHeight - Minimum height to search to
 * @returns The Y coordinate to start scanning from, or null if no air found
 */
function findFirstAirFromTop(
    dimension: MinecraftDimension,
    worldX: number,
    worldZ: number,
    maxHeight: number,
    minHeight: number
): number | null {
    for (let y = maxHeight; y >= minHeight; y--) {
        try {
            const block = dimension.getBlock({ x: worldX, y, z: worldZ });
            if (isAirBlock(block?.typeId)) {
                return y;
            }
        } catch {
            // Block in unloaded chunk, continue searching
            continue;
        }
    }
    return null;
}

/**
 * Result from a surface block raycast
 */
export interface SurfaceBlockResult {
    readonly block: Block;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly type: string;
    readonly mapColor: RGBA;
    /**
     * For water blocks, the depth to the first non-water block below.
     * Used for Minecraft's water depth shading with checkerboard patterns.
     * Undefined for non-water blocks.
     */
    readonly waterDepth?: number;
}

/**
 * Check if a block type is water
 */
function isWaterBlock(typeId: string): boolean {
    return typeId.includes('water');
}

/**
 * Calculate water depth by finding the first non-water block below.
 *
 * @param dimension - The Minecraft dimension
 * @param startX - X coordinate
 * @param startY - Y coordinate of water surface
 * @param startZ - Z coordinate
 * @param minHeight - Minimum world height
 * @returns Depth in blocks to first non-water block, or undefined if not water
 */
function calculateWaterDepth(
    dimension: MinecraftDimension,
    startX: number,
    startY: number,
    startZ: number,
    minHeight: number
): number | undefined {
    let depth = 0;
    let currentY = startY;

    // Count water blocks downward
    while (currentY >= minHeight) {
        try {
            const block = dimension.getBlock({ x: startX, y: currentY, z: startZ });

            if (!block?.typeId || !isWaterBlock(block.typeId)) {
                // Found first non-water block
                return depth > 0 ? depth : undefined;
            }

            depth++;
            currentY--;
        } catch {
            // Block in unloaded chunk
            break;
        }
    }

    return depth > 0 ? depth : undefined;
}

/**
 * Find the topmost block with a valid map color at a given X, Z coordinate.
 * Uses raycasting to find the first solid block, then iterates downward
 * until a block with a BlockMapColorComponent is found.
 *
 * For the Nether, uses a special strategy that first finds the first air block
 * below the bedrock ceiling before starting the raycast.
 *
 * @param dimension - The Minecraft dimension to scan
 * @param worldX - World X coordinate
 * @param worldZ - World Z coordinate
 * @param options - Raycast options
 * @returns Surface block result with valid map color, or null if no suitable block found
 */
export function getSurfaceBlock(
    dimension: MinecraftDimension,
    worldX: number,
    worldZ: number,
    options: RaycastOptions = {}
): SurfaceBlockResult | null {
    const { includeLiquidBlocks = true, includePassableBlocks = true } = options;
    const maxHeight = getMaxHeight(dimension.id);
    const minHeight = getMinHeight(dimension.id);
    const scanStrategy = getScanStrategy(dimension.id);

    // Determine the starting Y position based on the scan strategy
    let startY = maxHeight;

    if (scanStrategy === ScanStartStrategy.FromFirstAir) {
        // For Nether: find the first air block from the top (below bedrock ceiling)
        const firstAirY = findFirstAirFromTop(dimension, worldX, worldZ, maxHeight, minHeight);
        if (firstAirY === null) {
            // No air found in the column, nothing to render
            return null;
        }
        startY = firstAirY;
    }

    // Start from determined height and cast downward to find the first block
    const raycastResult = dimension.getBlockFromRay(
        { x: worldX + 0.5, y: startY, z: worldZ + 0.5 }, // Start from determined height, center of block
        { x: 0, y: -1, z: 0 }, // Cast downward
        {
            includeLiquidBlocks,
            includePassableBlocks,
            maxDistance: startY - minHeight + 1, // Distance from start to min height
        }
    );

    if (!raycastResult?.block?.typeId) {
        return null;
    }

    // Start from the raycast hit and iterate downward until we find a block with a valid map color
    let currentY = raycastResult.block.location.y;

    while (currentY >= minHeight) {
        try {
            const block = dimension.getBlock({ x: worldX, y: currentY, z: worldZ });

            if (block?.typeId) {
                const mapColor = getBlockMapColor(block);

                if (mapColor) {
                    // Calculate water depth if this is a water block
                    const waterDepth = isWaterBlock(block.typeId)
                        ? calculateWaterDepth(dimension, worldX, currentY, worldZ, minHeight)
                        : undefined;

                    return {
                        block,
                        x: worldX,
                        y: currentY,
                        z: worldZ,
                        type: block.typeId,
                        mapColor,
                        waterDepth,
                    };
                } else {
                    logDebug(
                        LOG_TAG,
                        `Block at (${worldX}, ${currentY}, ${worldZ}) of type ${block.typeId} has no valid map color`
                    );
                }
            }
        } catch {
            logDebug(LOG_TAG, `Failed to get block at (${worldX}, ${currentY}, ${worldZ})`);
            // Block might be in unloaded chunk, continue searching
        }

        currentY--;
    }

    // No block with a valid map color found
    return null;
}

/**
 * Convert a surface block result to chunk block format
 */
function toChunkBlock(result: SurfaceBlockResult): MinecraftChunkBlock {
    const block: MinecraftChunkBlock = {
        x: result.x,
        y: result.y,
        z: result.z,
        type: result.type,
        mapColor: result.mapColor,
        waterDepth: result.waterDepth,
    };
    return block;
}

/**
 * Scan a 16x16 chunk and collect top-level block data for map rendering
 * Uses block ray casting to include water and other liquid blocks
 *
 * @param dimension - The dimension to scan
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @returns Chunk data with all surface blocks
 */
export function scanChunk(dimension: MinecraftDimension, chunkX: number, chunkZ: number): MinecraftChunkData {
    const blocks: MinecraftChunkBlock[] = [];
    const startX = chunkX * 16;
    const startZ = chunkZ * 16;

    // Scan each column in the 16x16 chunk
    for (let dx = 0; dx < 16; dx++) {
        for (let dz = 0; dz < 16; dz++) {
            const worldX = startX + dx;
            const worldZ = startZ + dz;

            try {
                const result = getSurfaceBlock(dimension, worldX, worldZ);
                if (result) {
                    blocks.push(toChunkBlock(result));
                }
            } catch {
                // Block might be in unloaded chunk, skip silently
                continue;
            }
        }
    }

    return {
        dimension: toDimension(dimension.id),
        chunkX,
        chunkZ,
        blocks,
    };
}

/**
 * Scan a rectangular area around a center point
 * Useful for localized updates when blocks change
 *
 * @param dimension - The dimension to scan
 * @param centerX - Center X coordinate
 * @param centerZ - Center Z coordinate
 * @param radius - Radius to scan (e.g., 1 for 3x3, 2 for 5x5)
 * @returns Chunk data with surface blocks in the area
 */
export function scanArea(
    dimension: MinecraftDimension,
    centerX: number,
    centerZ: number,
    radius: number = 1
): MinecraftChunkData {
    const blocks: MinecraftChunkBlock[] = [];
    const { chunkX, chunkZ } = getChunkCoordinates(centerX, centerZ);

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            const worldX = centerX + dx;
            const worldZ = centerZ + dz;

            try {
                const result = getSurfaceBlock(dimension, worldX, worldZ);
                if (result) {
                    blocks.push(toChunkBlock(result));
                }
            } catch {
                // Block might be in unloaded chunk, skip silently
                continue;
            }
        }
    }

    return {
        dimension: toDimension(dimension.id),
        chunkX,
        chunkZ,
        blocks,
    };
}
