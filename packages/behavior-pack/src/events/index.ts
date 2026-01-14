/**
 * World event listeners for block changes, player events, etc.
 */

import { world, Player, Block, BlockPermutation, BlockMapColorComponent } from '@minecraft/server';
import type { Dimension } from '@minecraft-map/shared';
import type { MinecraftBlockEvent, MinecraftPlayer } from '../types';
import { serializeBlockChange, serializePlayer, serializePlayers, serializeChunkData } from '../serializers';
import { sendBlockChanges, sendPlayerPositions, sendChunkData } from '../network';
import { config } from '../config';
import type { MinecraftChunkData, MinecraftChunkBlock } from '../types';

/**
 * Convert Minecraft dimension ID to our Dimension type
 */
function toDimension(dimensionId: string): Dimension {
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
 * Extract block type from a Block or BlockPermutation
 */
function getBlockType(block: Block | BlockPermutation | undefined): string {
  if (!block) return 'air';
  if ('typeId' in block) {
    return block.typeId ?? 'air';
  }
  return 'air';
}

/**
 * Log debug messages
 */
function logDebug(message: string, data?: unknown): void {
  if (config.debug) {
    console.log(`[MapSync Events] ${message}`, data ? JSON.stringify(data) : '');
  }
}

/**
 * Pending block changes to be batched
 */
const pendingBlockChanges: MinecraftBlockEvent[] = [];
let blockBatchTimeout: number | null = null;

/**
 * Flush pending block changes to the server
 */
async function flushBlockChanges(): Promise<void> {
  if (pendingBlockChanges.length === 0) return;

  const changes = pendingBlockChanges.splice(0, pendingBlockChanges.length);
  const serialized = changes.map(serializeBlockChange);

  logDebug(`Flushing ${serialized.length} block changes`);
  await sendBlockChanges(serialized);
}

/**
 * Queue a block change for batched sending
 */
function queueBlockChange(event: MinecraftBlockEvent): void {
  pendingBlockChanges.push(event);

  // Set up batching timeout if not already set
  if (blockBatchTimeout === null) {
    // We use a simple counter-based approach since Minecraft doesn't have setTimeout
    // The actual batching will happen on the next system run
  }
}

/**
 * Register block place event listener
 */
export function registerBlockPlaceListener(): void {
  world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const { player, block } = event;

    if (!block || !player) return;

    const blockEvent: MinecraftBlockEvent = {
      dimension: toDimension(block.dimension.id),
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
      blockType: getBlockType(block),
      previousType: 'air',
      playerName: player.name,
    };

    logDebug('Block placed', blockEvent);
    queueBlockChange(blockEvent);
    flushBlockChanges();
  });

  logDebug('Block place listener registered');
}

/**
 * Calculate chunk coordinates from world coordinates
 *
 * @param x - World X coordinate
 * @param z - World Z coordinate
 * @returns Chunk coordinates (chunkX, chunkZ)
 */
function getChunkCoordinates(x: number, z: number): { chunkX: number; chunkZ: number } {
  return {
    chunkX: Math.floor(x / 16),
    chunkZ: Math.floor(z / 16),
  };
}

/**
 * Get the maximum build height for a dimension
 */
function getMaxHeight(dimensionId: string): number {
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
 * Scan a 16x16 chunk and collect top-level block data for map rendering
 * Uses block ray casting to include water and other liquid blocks
 *
 * @param dimension - The dimension to scan
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @returns Chunk data with all surface blocks
 */
function scanChunk(
  dimension: import('@minecraft/server').Dimension,
  chunkX: number,
  chunkZ: number
): MinecraftChunkData {
  const blocks: MinecraftChunkBlock[] = [];
  const startX = chunkX * 16;
  const startZ = chunkZ * 16;
  const maxHeight = getMaxHeight(dimension.id);

  // Scan each column in the 16x16 chunk
  for (let dx = 0; dx < 16; dx++) {
    for (let dz = 0; dz < 16; dz++) {
      const worldX = startX + dx;
      const worldZ = startZ + dz;

      try {
        // Use block ray cast downward to find the topmost block (including water/liquids)
        const raycastResult = dimension.getBlockFromRay(
          { x: worldX + 0.5, y: maxHeight, z: worldZ + 0.5 }, // Start from max height, center of block
          { x: 0, y: -1, z: 0 }, // Cast downward
          {
            includeLiquidBlocks: true,
            includePassableBlocks: true,
            maxDistance: maxHeight + 64, // Account for negative Y in overworld
          }
        );

        if (raycastResult && raycastResult.block && raycastResult.block.typeId) {
          const block = raycastResult.block;
          const mapColor = block.getComponent(BlockMapColorComponent.componentId);
          blocks.push({
            x: worldX,
            y: block.location.y,
            z: worldZ,
            type: block.typeId,
            mapColor: mapColor ? mapColor.tintedColor : { red: 1, green: 1, blue: 1, alpha: 1 },
          });
        }
      } catch {
        // Block might be in unloaded chunk, skip
        console.log(`[MapSync Events] Failed to get block at (${worldX}, ?, ${worldZ}) in dimension ${dimension.id}`);
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
 * Scan and send chunk data to the server
 *
 * @param dimension - The dimension containing the chunk
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 */
async function scanAndSendChunk(
  dimension: import('@minecraft/server').Dimension,
  chunkX: number,
  chunkZ: number
): Promise<void> {
  const chunkData = scanChunk(dimension, chunkX, chunkZ);
  const serialized = serializeChunkData(chunkData);

  logDebug(`Sending chunk update (${chunkX}, ${chunkZ})`, { blockCount: chunkData.blocks.length });
  await sendChunkData([serialized]);
}

/**
 * Scan a 3x3 area around a block and collect top-level block data
 * Used for localized updates when a block is broken
 *
 * @param dimension - The dimension to scan
 * @param centerX - Center X coordinate
 * @param centerZ - Center Z coordinate
 * @returns Chunk data with surface blocks in the 3x3 area
 */
function scanArea3x3(
  dimension: import('@minecraft/server').Dimension,
  centerX: number,
  centerZ: number
): MinecraftChunkData {
  const blocks: MinecraftChunkBlock[] = [];
  const maxHeight = getMaxHeight(dimension.id);
  const { chunkX, chunkZ } = getChunkCoordinates(centerX, centerZ);

  // Scan 3x3 area centered on the broken block
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const worldX = centerX + dx;
      const worldZ = centerZ + dz;

      try {
        // Use block ray cast downward to find the topmost block (including water/liquids)
        const raycastResult = dimension.getBlockFromRay(
          { x: worldX + 0.5, y: maxHeight, z: worldZ + 0.5 },
          { x: 0, y: -1, z: 0 },
          {
            includeLiquidBlocks: true,
            includePassableBlocks: true,
            maxDistance: maxHeight + 64,
          }
        );

        if (raycastResult && raycastResult.block && raycastResult.block.typeId) {
          const block = raycastResult.block;
          const mapColor = block.getComponent(BlockMapColorComponent.componentId);
          blocks.push({
            x: worldX,
            y: block.location.y,
            z: worldZ,
            type: block.typeId,
            mapColor: mapColor ? mapColor.tintedColor : { red: 1, green: 1, blue: 1, alpha: 1 },
          });
        }
      } catch {
        // Block might be in unloaded chunk, skip
        logDebug(`Failed to get block at (${worldX}, ?, ${worldZ})`);
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
 * Register block break event listener
 */
export function registerBlockBreakListener(): void {
  world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, block, brokenBlockPermutation } = event;

    if (!block || !player) return;

    const blockEvent: MinecraftBlockEvent = {
      dimension: toDimension(block.dimension.id),
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
      blockType: 'air',
      previousType: getBlockType(brokenBlockPermutation),
      playerName: player.name,
    };

    logDebug('Block broken', blockEvent);
    queueBlockChange(blockEvent);
    flushBlockChanges();

    // Scan and send a 3x3 area around the broken block
    const chunkData = scanArea3x3(block.dimension, block.location.x, block.location.z);
    const serialized = serializeChunkData(chunkData);
    
    logDebug(`Sending 3x3 area update around (${block.location.x}, ${block.location.z})`, { blockCount: chunkData.blocks.length });
    sendChunkData([serialized]).catch((error) => {
      logDebug('Failed to send area update', error);
    });
  });

  logDebug('Block break listener registered');
}

/**
 * Register player join event listener
 */
export function registerPlayerJoinListener(): void {
  world.afterEvents.playerJoin.subscribe((event) => {
    const { playerName } = event;
    logDebug(`Player joined: ${playerName}`);
    
    // Send updated player list after a short delay to let player fully load
    updatePlayerPositions();
  });

  logDebug('Player join listener registered');
}

/**
 * Register player leave event listener
 */
export function registerPlayerLeaveListener(): void {
  world.afterEvents.playerLeave.subscribe((event) => {
    const { playerName } = event;
    logDebug(`Player left: ${playerName}`);
    
    // Send updated player list
    updatePlayerPositions();
  });

  logDebug('Player leave listener registered');
}

/**
 * Get all current players and their positions
 */
function getAllPlayers(): MinecraftPlayer[] {
  const players: MinecraftPlayer[] = [];

  for (const player of world.getAllPlayers()) {
    try {
      const location = player.location;
      const dimension = player.dimension;

      players.push({
        name: player.name,
        x: location.x,
        y: location.y,
        z: location.z,
        dimension: toDimension(dimension.id),
      });
    } catch (error) {
      // Player may be in an invalid state, skip
      logDebug(`Failed to get player data for ${player.name}`, error);
    }
  }

  return players;
}

/**
 * Update player positions and send to server
 */
export async function updatePlayerPositions(): Promise<void> {
  const players = getAllPlayers();
  
  if (players.length === 0) {
    logDebug('No players to update');
    return;
  }

  const serialized = serializePlayers(players);
  logDebug(`Updating ${serialized.length} player positions`);
  await sendPlayerPositions(serialized);
}

/**
 * Register all event listeners
 */
export function registerAllEventListeners(): void {
  registerBlockPlaceListener();
  registerBlockBreakListener();
  registerPlayerJoinListener();
  registerPlayerLeaveListener();

  console.log('[MapSync] All event listeners registered');
}
