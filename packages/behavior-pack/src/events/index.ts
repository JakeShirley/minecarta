/**
 * World event listeners for block changes, player events, etc.
 */

import { world, Block, BlockPermutation } from '@minecraft/server';
import { beforeEvents } from '@minecraft/server-admin';
import type { MinecraftBlockEvent, MinecraftPlayer } from '../types';
import { serializeBlockChange, serializePlayers, serializeChunkData } from '../serializers';
import { sendBlockChanges, sendPlayerPositions, sendChunkData, checkChunkExists } from '../network';
import { config } from '../config';
import { toDimension, scanArea, scanChunk, getChunkCoordinates } from '../blocks';

/**
 * Map of player names to their PlayFab IDs.
 * Populated when players join via the async player join event.
 */
const playerPlayfabIds: Map<string, string> = new Map();

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

    // Scan and send a 3x3 area around the broken block (radius=1 for 3x3)
    const chunkData = scanArea(block.dimension, block.location.x, block.location.z, 1);
    const serialized = serializeChunkData(chunkData);
    
    logDebug(`Sending 3x3 area update around (${block.location.x}, ${block.location.z})`, { blockCount: chunkData.blocks.length });
    sendChunkData([serialized]).catch((error) => {
      logDebug('Failed to send area update', error);
    });
  });

  logDebug('Block break listener registered');
}

/**
 * Register async player join event listener to capture persistent IDs.
 * This uses the @minecraft/server-admin module to get the player's PlayFab ID.
 */
export function registerAsyncPlayerJoinListener(): void {
  beforeEvents.asyncPlayerJoin.subscribe(async (event) => {
    const { name, persistentId } = event;
    logDebug(`Async player join: ${name} with playfabId: ${persistentId}`);
    
    // Store the PlayFab ID for this player
    playerPlayfabIds.set(name, persistentId);
  });

  logDebug('Async player join listener registered');
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
    
    // Clean up the PlayFab ID mapping
    playerPlayfabIds.delete(playerName);
    
    // Send updated player list
    updatePlayerPositions();
  });

  logDebug('Player leave listener registered');
}

/**
 * Track chunks that have been recently checked to avoid repeated lookups.
 * Key format: "dimension:chunkX:chunkZ"
 */
const recentlyCheckedChunks: Map<string, number> = new Map();

/**
 * How long to cache chunk check results (in milliseconds)
 */
const CHUNK_CHECK_CACHE_TTL = 60000; // 1 minute

/**
 * Get a cache key for a chunk
 */
function getChunkCacheKey(dimension: string, chunkX: number, chunkZ: number): string {
  return `${dimension}:${chunkX}:${chunkZ}`;
}

/**
 * Check if a chunk was recently checked
 */
function wasRecentlyChecked(key: string): boolean {
  const lastChecked = recentlyCheckedChunks.get(key);
  if (lastChecked === undefined) return false;
  return Date.now() - lastChecked < CHUNK_CHECK_CACHE_TTL;
}

/**
 * Mark a chunk as recently checked
 */
function markChunkChecked(key: string): void {
  recentlyCheckedChunks.set(key, Date.now());
  
  // Clean up old entries periodically
  if (recentlyCheckedChunks.size > 1000) {
    const now = Date.now();
    for (const [k, timestamp] of recentlyCheckedChunks.entries()) {
      if (now - timestamp > CHUNK_CHECK_CACHE_TTL) {
        recentlyCheckedChunks.delete(k);
      }
    }
  }
}

/**
 * Check if a player's current chunk needs generation and send data if needed
 */
async function checkAndGeneratePlayerChunk(player: MinecraftPlayer): Promise<void> {
  const { chunkX, chunkZ } = getChunkCoordinates(player.x, player.z);
  const cacheKey = getChunkCacheKey(player.dimension, chunkX, chunkZ);
  
  // Skip if we recently checked this chunk
  if (wasRecentlyChecked(cacheKey)) {
    return;
  }
  
  // Mark as checked immediately to prevent duplicate checks
  markChunkChecked(cacheKey);
  
  // Ask server if chunk exists
  const exists = await checkChunkExists(player.dimension, chunkX, chunkZ);
  
  if (!exists) {
    logDebug(`Chunk (${chunkX}, ${chunkZ}) in ${player.dimension} needs generation, scanning...`);
    
    // Get the Minecraft dimension object
    const dimensionId = player.dimension === 'overworld' 
      ? 'minecraft:overworld' 
      : player.dimension === 'nether'
        ? 'minecraft:nether'
        : 'minecraft:the_end';
    
    try {
      const dimension = world.getDimension(dimensionId);
      const chunkData = scanChunk(dimension, chunkX, chunkZ);
      const serialized = serializeChunkData(chunkData);
      
      logDebug(`Sending chunk (${chunkX}, ${chunkZ}) with ${chunkData.blocks.length} blocks`);
      await sendChunkData([serialized]);
    } catch (error) {
      logDebug(`Failed to scan chunk (${chunkX}, ${chunkZ})`, error);
    }
  }
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
        playfabId: playerPlayfabIds.get(player.name),
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
  
  // Check if any player's current chunk needs generation
  // Process one player at a time to avoid overwhelming the server
  for (const player of players) {
    await checkAndGeneratePlayerChunk(player);
  }
}

/**
 * Register all event listeners
 */
export function registerAllEventListeners(): void {
  registerAsyncPlayerJoinListener();
  registerBlockPlaceListener();
  registerBlockBreakListener();
  registerPlayerJoinListener();
  registerPlayerLeaveListener();

  console.log('[MapSync] All event listeners registered');
}
