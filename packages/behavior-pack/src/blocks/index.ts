/**
 * Centralized block scanning and color utilities
 *
 * This module provides unified functions for ray casting, block color extraction,
 * and chunk scanning operations used throughout the behavior pack.
 */

import { BlockMapColorComponent, TintMethod } from '@minecraft/server';
import type { Dimension as MinecraftDimension, Block, RGBA } from '@minecraft/server';
import type { Dimension } from '@minecraft-map/shared';
import type { MinecraftChunkBlock, MinecraftChunkData } from '../types';

/**
 * Default color returned when block color cannot be determined
 */
const DEFAULT_BLOCK_COLOR: RGBA = { red: 0, green: 0, blue: 0, alpha: 0 };

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
      return 128;
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
export function getBlockMapColor(block: Block): RGBA {
  return block.getMapColor();
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
 * Result from a surface block raycast
 */
export interface SurfaceBlockResult {
  readonly block: Block;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly type: string;
  readonly mapColor: RGBA;
}

/**
 * Find the topmost block with a valid map color at a given X, Z coordinate.
 * Uses raycasting to find the first solid block, then iterates downward
 * until a block with a BlockMapColorComponent is found.
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

  // Start from max height and cast downward to find the first block
  const raycastResult = dimension.getBlockFromRay(
    { x: worldX + 0.5, y: maxHeight, z: worldZ + 0.5 }, // Start from max height, center of block
    { x: 0, y: -1, z: 0 }, // Cast downward
    {
      includeLiquidBlocks,
      includePassableBlocks,
      maxDistance: maxHeight + 64, // Account for negative Y in overworld
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
          return {
            block,
            x: worldX,
            y: currentY,
            z: worldZ,
            type: block.typeId,
            mapColor,
          };
        } else {
            console.log(`[SurfaceBlock] Block at (${worldX}, ${currentY}, ${worldZ}) of type ${block.typeId} has no valid map color`);
        }
      }
    } catch {
        console.log(`[SurfaceBlock] Failed to get block at (${worldX}, ${currentY}, ${worldZ})`);
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
  return {
    x: result.x,
    y: result.y,
    z: result.z,
    type: result.type,
    mapColor: result.mapColor,
  };
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
export function scanChunk(
  dimension: MinecraftDimension,
  chunkX: number,
  chunkZ: number
): MinecraftChunkData {
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
