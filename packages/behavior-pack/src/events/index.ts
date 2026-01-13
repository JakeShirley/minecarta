/**
 * World event listeners for block changes, player events, etc.
 */

import { world, Player, Block, BlockPermutation } from '@minecraft/server';
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
 * Scan a 16x16 chunk and collect top-level block data for map rendering
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

  // Scan each column in the 16x16 chunk
  for (let dx = 0; dx < 16; dx++) {
    for (let dz = 0; dz < 16; dz++) {
      const worldX = startX + dx;
      const worldZ = startZ + dz;

      // Find the top non-air block by scanning from the top down
      // Start from max height and work down
      for (let y = 320; y >= -64; y--) {
        try {
          const block = dimension.getBlock({ x: worldX, y, z: worldZ });
          if (block && block.typeId && block.typeId !== 'minecraft:air') {
            blocks.push({
              x: worldX,
              y,
              z: worldZ,
              type: block.typeId,
            });
            break; // Found the top block, move to next column
          }
        } catch {
          // Block might be in unloaded chunk, skip
          continue;
        }
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

    // Scan and send the entire chunk for the broken block
    const { chunkX, chunkZ } = getChunkCoordinates(block.location.x, block.location.z);
    scanAndSendChunk(block.dimension, chunkX, chunkZ).catch((error) => {
      logDebug('Failed to send chunk update', error);
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
