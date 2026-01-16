/**
 * World event listeners for block changes, player events, etc.
 */

import {
    world,
    Block,
    BlockPermutation,
    Player,
    EntityHealthComponent,
    EntityEquippableComponent,
    EquipmentSlot,
} from '@minecraft/server';
import { beforeEvents } from '@minecraft/server-admin';
import type { MinecraftBlockEvent, MinecraftPlayer } from '../types';
import type { PlayerStats } from '@minecarta/shared';
import { serializeBlockChange, serializePlayers } from '../serializers';
import {
    sendBlockChanges,
    sendPlayerPositions,
    sendPlayerJoin,
    sendPlayerLeave,
    sendChatMessage,
    checkChunkExists,
    sendWorldSpawn,
    sendPlayerSpawn,
    sendWorldTime,
    sendWorldWeather,
} from '../network';
import { config } from '../config';
import { logDebug, logError, logInfo } from '../logging';
import { toDimension, getChunkCoordinates } from '../blocks';
import { queueAreaScan, queueChunk, ChunkJobPriority } from '../chunk-queue';

/**
 * Dynamic property key for storing the player's PlayFab ID (PDIF).
 * This persists across script reloads (e.g., /reload command).
 */
const PLAYFAB_ID_PROPERTY = 'mapsync:playfabId';

/**
 * Logging tag for this module
 */
const LOG_TAG = 'Events';

/**
 * Map of player names to their PlayFab IDs.
 * Populated when players join via the async player join event.
 * This is a temporary cache until the player fully joins and we can
 * set the dynamic property on the player object.
 */
const pendingPlayfabIds: Map<string, string> = new Map();

/**
 * Get the PlayFab ID for a player, checking dynamic property first,
 * then falling back to the pending cache.
 */
function getPlayfabId(player: Player): string | undefined {
    // First, try to get from dynamic property (survives /reload)
    const dynamicProperty = player.getDynamicProperty(PLAYFAB_ID_PROPERTY);
    if (typeof dynamicProperty === 'string') {
        return dynamicProperty;
    }

    // Fall back to pending cache (for players still joining)
    return pendingPlayfabIds.get(player.name);
}

/**
 * Set the PlayFab ID as a dynamic property on the player object.
 * This persists across script reloads.
 */
function cachePlayfabIdToPlayer(player: Player, playfabId: string): void {
    try {
        player.setDynamicProperty(PLAYFAB_ID_PROPERTY, playfabId);
        logDebug(LOG_TAG, `Cached playfabId ${playfabId} to dynamic property for player ${player.name}`);
    } catch (error) {
        logError(LOG_TAG, `Failed to set dynamic property for player ${player.name}`, error);
    }
}

/**
 * Get player stats (health, hunger, armor) if sendPlayerStats is enabled.
 * Returns undefined if disabled or if stats cannot be retrieved.
 */
function getPlayerStats(player: Player): PlayerStats | undefined {
    if (!config.sendPlayerStats) {
        return undefined;
    }

    try {
        // Get health from the health component
        const healthComponent = player.getComponent('minecraft:health') as EntityHealthComponent | undefined;
        const health = healthComponent?.currentValue ?? 20;
        const maxHealth = healthComponent?.effectiveMax ?? 20;

        // Get hunger level - Bedrock uses a different property
        // In Bedrock, we need to use the player's food level which is accessed via the attribute system
        // Unfortunately, Bedrock script API doesn't directly expose hunger, so we'll try a workaround
        // For now, we'll use a default of 20 if not accessible
        let hunger = 20;
        try {
            // Try to get the food/hunger attribute if available
            const exhaustion = player.getDynamicProperty('hunger') as number | undefined;
            if (typeof exhaustion === 'number') {
                hunger = exhaustion;
            }
        } catch {
            // Hunger not accessible, use default
        }

        // Get armor points by checking equipped armor slots
        let armor = 0;
        try {
            const equippable = player.getComponent('minecraft:equippable') as EntityEquippableComponent | undefined;
            if (equippable) {
                // Check each armor slot and calculate total armor value
                const armorSlots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
                for (const slot of armorSlots) {
                    const item = equippable.getEquipment(slot);
                    if (item) {
                        // Estimate armor value based on item type
                        const typeId = item.typeId.toLowerCase();
                        armor += getArmorValue(typeId, slot);
                    }
                }
            }
        } catch {
            // Armor not accessible, use default 0
        }

        return {
            health,
            maxHealth,
            hunger,
            armor: Math.min(armor, 20), // Cap at 20
        };
    } catch (error) {
        logDebug(LOG_TAG, `Failed to get stats for player ${player.name}`, error);
        return undefined;
    }
}

/**
 * Get the armor value for a specific armor piece based on its type and slot.
 * Values based on Minecraft armor protection values.
 */
function getArmorValue(typeId: string, slot: EquipmentSlot): number {
    // Leather armor
    if (typeId.includes('leather')) {
        switch (slot) {
            case EquipmentSlot.Head:
                return 1;
            case EquipmentSlot.Chest:
                return 3;
            case EquipmentSlot.Legs:
                return 2;
            case EquipmentSlot.Feet:
                return 1;
            default:
                return 0;
        }
    }
    // Chain/Gold armor
    if (typeId.includes('chainmail') || typeId.includes('golden')) {
        switch (slot) {
            case EquipmentSlot.Head:
                return 2;
            case EquipmentSlot.Chest:
                return 5;
            case EquipmentSlot.Legs:
                return typeId.includes('chainmail') ? 4 : 3;
            case EquipmentSlot.Feet:
                return 1;
            default:
                return 0;
        }
    }
    // Iron armor
    if (typeId.includes('iron')) {
        switch (slot) {
            case EquipmentSlot.Head:
                return 2;
            case EquipmentSlot.Chest:
                return 6;
            case EquipmentSlot.Legs:
                return 5;
            case EquipmentSlot.Feet:
                return 2;
            default:
                return 0;
        }
    }
    // Diamond armor
    if (typeId.includes('diamond')) {
        switch (slot) {
            case EquipmentSlot.Head:
                return 3;
            case EquipmentSlot.Chest:
                return 8;
            case EquipmentSlot.Legs:
                return 6;
            case EquipmentSlot.Feet:
                return 3;
            default:
                return 0;
        }
    }
    // Netherite armor
    if (typeId.includes('netherite')) {
        switch (slot) {
            case EquipmentSlot.Head:
                return 3;
            case EquipmentSlot.Chest:
                return 8;
            case EquipmentSlot.Legs:
                return 6;
            case EquipmentSlot.Feet:
                return 3;
            default:
                return 0;
        }
    }
    // Turtle shell (helmet only)
    if (typeId.includes('turtle')) {
        return 2;
    }
    return 0;
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

    logDebug(LOG_TAG, `Flushing ${serialized.length} block changes`);
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
    world.afterEvents.playerPlaceBlock.subscribe(event => {
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

        logDebug(LOG_TAG, 'Block placed', blockEvent);
        queueBlockChange(blockEvent);
        flushBlockChanges();

        // Queue a 3x3 area scan around the placed block with immediate priority
        const dimension = toDimension(block.dimension.id);
        queueAreaScan(dimension, block.location.x, block.location.z, 1, {
            priority: ChunkJobPriority.Immediate,
            sourcePlayer: player.name,
        });

        logDebug(LOG_TAG, `Queued 3x3 area update around (${block.location.x}, ${block.location.z})`);
    });

    logDebug(LOG_TAG, 'Block place listener registered');
}

/**
 * Register block break event listener
 */
export function registerBlockBreakListener(): void {
    world.afterEvents.playerBreakBlock.subscribe(event => {
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

        logDebug(LOG_TAG, 'Block broken', blockEvent);
        queueBlockChange(blockEvent);
        flushBlockChanges();

        // Queue a 3x3 area scan around the broken block with immediate priority
        const dimension = toDimension(block.dimension.id);
        queueAreaScan(dimension, block.location.x, block.location.z, 1, {
            priority: ChunkJobPriority.Immediate,
            sourcePlayer: player.name,
        });

        logDebug(LOG_TAG, `Queued 3x3 area update around (${block.location.x}, ${block.location.z})`);
    });

    logDebug(LOG_TAG, 'Block break listener registered');
}

/**
 * Register async player join event listener to capture persistent IDs.
 * This uses the @minecraft/server-admin module to get the player's PlayFab ID.
 * The ID is stored temporarily until the player fully joins, at which point
 * it's cached to a dynamic property on the player object.
 */
export function registerAsyncPlayerJoinListener(): void {
    beforeEvents.asyncPlayerJoin.subscribe(async event => {
        const { name, persistentId } = event;
        logDebug(LOG_TAG, `Async player join: ${name} with playfabId: ${persistentId}`);

        // Store the PlayFab ID temporarily until player fully joins
        pendingPlayfabIds.set(name, persistentId);
    });

    logDebug(LOG_TAG, 'Async player join listener registered');
}

/**
 * Register player join event listener
 */
export function registerPlayerJoinListener(): void {
    world.afterEvents.playerSpawn.subscribe(event => {
        if (event.initialSpawn === false) {
            // Ignore respawns
            return;
        }

        const player = event.player;
        const playerName = event.player.name;
        const pendingId = pendingPlayfabIds.get(playerName);
        if (pendingId) {
            cachePlayfabIdToPlayer(event.player, pendingId);
            // Clean up the pending cache
            pendingPlayfabIds.delete(playerName);
        }

        // Send player join event to the server
        try {
            const location = player.location;
            const dimension = player.dimension;
            const playfabId = getPlayfabId(player);
            const stats = getPlayerStats(player);

            const playerData = {
                name: playerName,
                x: location.x,
                y: location.y,
                z: location.z,
                dimension: toDimension(dimension.id),
                playfabId,
                stats,
            };

            logDebug(LOG_TAG, `Sending player join: ${playerName}`, playerData);
            sendPlayerJoin(playerData).catch(error => {
                logError(LOG_TAG, 'Failed to send player join', error);
            });

            // Sync the player's spawn point (bed location)
            syncPlayerSpawn(player).catch(error => {
                logError(LOG_TAG, 'Failed to sync player spawn point', error);
            });
        } catch (error) {
            logError(LOG_TAG, `Failed to get player data for join event: ${playerName}`, error);
            // Fall back to updating all player positions
            updatePlayerPositions();
        }
    });

    logDebug(LOG_TAG, 'Player join listener registered');
}

/**
 * Register player leave event listener
 */
export function registerPlayerLeaveListener(): void {
    world.afterEvents.playerLeave.subscribe(event => {
        const { playerName } = event;
        logDebug(LOG_TAG, `Player left: ${playerName}`);

        // Clean up the pending PlayFab ID mapping (dynamic property persists with the player)
        pendingPlayfabIds.delete(playerName);

        // Send player leave event to the server
        sendPlayerLeave(playerName).catch(error => {
            logError(LOG_TAG, 'Failed to send player leave', error);
        });
    });

    logDebug(LOG_TAG, 'Player leave listener registered');
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
        logDebug(LOG_TAG, `Chunk (${chunkX}, ${chunkZ}) in ${player.dimension} needs generation, queueing...`);

        // Queue the chunk with high priority since it's the player's current chunk
        queueChunk(player.dimension, chunkX, chunkZ, {
            priority: ChunkJobPriority.High,
            sourcePlayer: player.name,
        });
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

            // Get PlayFab ID from dynamic property (survives /reload) or pending cache
            const playfabId = getPlayfabId(player);

            // Get player stats if enabled
            const stats = getPlayerStats(player);

            players.push({
                name: player.name,
                x: location.x,
                y: location.y,
                z: location.z,
                dimension: toDimension(dimension.id),
                playfabId,
                stats,
            });
        } catch (error) {
            // Player may be in an invalid state, skip
            logDebug(LOG_TAG, `Failed to get player data for ${player.name}`, error);
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
        logDebug(LOG_TAG, 'No players to update');
        return;
    }

    const serialized = serializePlayers(players);
    await sendPlayerPositions(serialized);

    // Check if any player's current chunk needs generation
    // Process one player at a time to avoid overwhelming the server
    for (const player of players) {
        await checkAndGeneratePlayerChunk(player);
    }
}

/**
 * Send world spawn location to the server.
 * Called on boot to sync the default spawn point.
 */
export async function syncWorldSpawn(): Promise<void> {
    try {
        const spawnLocation = world.getDefaultSpawnLocation();

        logDebug(LOG_TAG, `World spawn location: (${spawnLocation.x}, ${spawnLocation.y}, ${spawnLocation.z})`);

        await sendWorldSpawn({
            x: spawnLocation.x,
            y: spawnLocation.y,
            z: spawnLocation.z,
            dimension: 'overworld', // World spawn is always in overworld
        });
    } catch (error) {
        logError(LOG_TAG, 'Failed to sync world spawn', error);
    }
}

/**
 * Send a player's spawn point (bed location) to the server.
 * Called when a player joins to sync their respawn point.
 */
export async function syncPlayerSpawn(player: Player): Promise<void> {
    try {
        const spawnPoint = player.getSpawnPoint();

        if (!spawnPoint) {
            logDebug(LOG_TAG, `Player ${player.name} has no spawn point set`);
            return;
        }

        const dimension = toDimension(spawnPoint.dimension.id);

        logDebug(
            LOG_TAG,
            `Player ${player.name} spawn point: (${spawnPoint.x}, ${spawnPoint.y}, ${spawnPoint.z}) in ${dimension}`
        );

        await sendPlayerSpawn({
            playerName: player.name,
            x: spawnPoint.x,
            y: spawnPoint.y,
            z: spawnPoint.z,
            dimension,
        });
    } catch (error) {
        logError(LOG_TAG, `Failed to sync spawn for player ${player.name}`, error);
    }
}

/**
 * Tracks the last synced time of day to detect significant changes
 * (e.g., from /time set commands or sleeping)
 */
let lastSyncedTimeOfDay: number | null = null;

/**
 * Threshold for detecting "significant" time changes (in ticks).
 * If the actual time differs from expected by more than this, we sync immediately.
 * 600 ticks = 30 seconds of game time, or 1.5 real-world seconds worth of drift.
 */
const TIME_CHANGE_THRESHOLD = 600;

/**
 * Send world time to the server.
 * Called periodically and when significant time changes are detected.
 *
 * @param force - If true, always send the update regardless of change detection
 */
export async function syncWorldTime(force = false): Promise<void> {
    try {
        const timeOfDay = world.getTimeOfDay();
        const absoluteTime = world.getAbsoluteTime();
        const day = world.getDay();

        // Check if this is a significant time change that warrants an immediate sync
        let shouldSync = force;

        if (!shouldSync && lastSyncedTimeOfDay !== null) {
            // Calculate expected time based on elapsed ticks since last sync
            // If the actual time differs significantly, a time change occurred
            const timeDiff = Math.abs(timeOfDay - lastSyncedTimeOfDay);

            // Handle day boundary wrapping (23999 -> 0)
            const wrappedDiff = Math.min(timeDiff, 24000 - timeDiff);

            // If time changed more than threshold, it's likely a /time set or sleep
            if (wrappedDiff > TIME_CHANGE_THRESHOLD) {
                shouldSync = true;
                logDebug(LOG_TAG, `Significant time change detected: ${lastSyncedTimeOfDay} -> ${timeOfDay}`);
            }
        }

        // On first call, always sync
        if (lastSyncedTimeOfDay === null) {
            shouldSync = true;
        }

        if (shouldSync) {
            lastSyncedTimeOfDay = timeOfDay;

            logDebug(LOG_TAG, `Syncing world time: day ${day}, timeOfDay ${timeOfDay}`);

            await sendWorldTime({
                timeOfDay,
                absoluteTime,
                day,
            });
        }
    } catch (error) {
        logError(LOG_TAG, 'Failed to sync world time', error);
    }
}

/**
 * Check world time for changes and sync if significant.
 * Called frequently (with player updates) to detect /time set commands.
 */
export function checkWorldTimeChange(): void {
    if (lastSyncedTimeOfDay === null) {
        return;
    }

    const timeOfDay = world.getTimeOfDay();

    // Calculate the difference accounting for day wrapping
    const timeDiff = Math.abs(timeOfDay - lastSyncedTimeOfDay);
    const wrappedDiff = Math.min(timeDiff, 24000 - timeDiff);

    // If time changed more than threshold, sync immediately
    if (wrappedDiff > TIME_CHANGE_THRESHOLD) {
        syncWorldTime(true).catch(error => {
            logError(LOG_TAG, 'Failed to sync time after change detection', error);
        });
    }
}

// ==========================================
// Weather Tracking and Sync
// ==========================================

/**
 * Current weather state, tracked from events.
 * Minecraft doesn't have a getWeather() API, so we track it from weatherChange events.
 */
let currentWeather: 'Clear' | 'Rain' | 'Thunder' = 'Clear';

/**
 * Send world weather to the server.
 * Called on boot (after first weather event) and when weather changes.
 */
export async function syncWorldWeather(): Promise<void> {
    try {
        logDebug(LOG_TAG, `Syncing world weather: ${currentWeather}`);

        await sendWorldWeather({
            weather: currentWeather,
            dimension: 'overworld', // Weather is global, we report from overworld
        });
    } catch (error) {
        logError(LOG_TAG, 'Failed to sync world weather', error);
    }
}

/**
 * Register weather change event listener.
 * This tracks weather changes and syncs to the server.
 */
export function registerWeatherChangeListener(): void {
    world.afterEvents.weatherChange.subscribe(event => {
        const { newWeather, dimension } = event;

        // Update our tracked weather state
        currentWeather = newWeather as 'Clear' | 'Rain' | 'Thunder';

        logDebug(LOG_TAG, `Weather changed to ${newWeather} in ${dimension}`);

        // Sync to server immediately on weather change
        syncWorldWeather().catch(error => {
            logError(LOG_TAG, 'Failed to sync weather after change', error);
        });
    });

    logDebug(LOG_TAG, 'Weather change listener registered');
}

/**
 * Register chat message event listener
 */
export function registerChatListener(): void {
    world.afterEvents.chatSend.subscribe(event => {
        const { sender, message } = event;

        if (!sender) return;

        try {
            const dimension = toDimension(sender.dimension.id);

            logDebug(LOG_TAG, `Chat message from ${sender.name}: ${message}`);

            sendChatMessage(sender.name, message, dimension).catch(error => {
                logError(LOG_TAG, 'Failed to send chat message', error);
            });
        } catch (error) {
            logError(LOG_TAG, `Failed to process chat message from ${sender.name}`, error);
        }
    });

    logDebug(LOG_TAG, 'Chat listener registered');
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
    registerChatListener();
    registerWeatherChangeListener();

    logInfo(LOG_TAG, 'All event listeners registered');
}
