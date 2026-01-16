/**
 * Data serialization utilities for converting Minecraft data to API format
 */

import type { BlockChange, Player, Entity, ChunkData, ChunkBlock, PlayerStats } from '@minecarta/shared';
import type {
    MinecraftBlockEvent,
    MinecraftPlayer,
    MinecraftEntity,
    MinecraftChunkData,
    MinecraftChunkBlock,
} from '../types';

/**
 * Serialize a block event to the API format
 *
 * @param event - Minecraft block event data
 * @returns BlockChange object for API transmission
 */
export function serializeBlockChange(event: MinecraftBlockEvent): BlockChange {
    return {
        dimension: event.dimension,
        x: Math.floor(event.x),
        y: Math.floor(event.y),
        z: Math.floor(event.z),
        blockType: normalizeBlockType(event.blockType),
        previousType: event.previousType ? normalizeBlockType(event.previousType) : undefined,
        player: event.playerName,
        timestamp: Date.now(),
    };
}

/**
 * Serialize player stats to the API format
 *
 * @param stats - Player stats data
 * @returns PlayerStats object for API transmission
 */
export function serializePlayerStats(stats: PlayerStats): PlayerStats {
    return {
        health: Math.round(stats.health * 10) / 10, // Round to 1 decimal place
        maxHealth: Math.round(stats.maxHealth * 10) / 10,
        hunger: Math.round(stats.hunger),
        armor: Math.round(stats.armor),
    };
}

/**
 * Serialize player data to the API format
 *
 * @param player - Minecraft player data
 * @returns Player object for API transmission
 */
export function serializePlayer(player: MinecraftPlayer): Player {
    return {
        name: player.name,
        x: Math.floor(player.x),
        y: Math.floor(player.y),
        z: Math.floor(player.z),
        dimension: player.dimension,
        lastSeen: Date.now(),
        playfabId: player.playfabId,
        stats: player.stats ? serializePlayerStats(player.stats) : undefined,
    };
}

/**
 * Serialize entity data to the API format
 *
 * @param entity - Minecraft entity data
 * @returns Entity object for API transmission
 */
export function serializeEntity(entity: MinecraftEntity): Entity {
    return {
        id: entity.id,
        type: normalizeEntityType(entity.type),
        x: Math.floor(entity.x),
        y: Math.floor(entity.y),
        z: Math.floor(entity.z),
        dimension: entity.dimension,
    };
}

/**
 * Normalize block type identifier by removing 'minecraft:' prefix
 *
 * @param blockType - Raw block type string
 * @returns Normalized block type without namespace prefix
 */
export function normalizeBlockType(blockType: string): string {
    return blockType.replace(/^minecraft:/, '');
}

/**
 * Normalize entity type identifier by removing 'minecraft:' prefix
 *
 * @param entityType - Raw entity type string
 * @returns Normalized entity type without namespace prefix
 */
export function normalizeEntityType(entityType: string): string {
    return entityType.replace(/^minecraft:/, '');
}

/**
 * Batch serialize multiple block changes
 *
 * @param events - Array of Minecraft block events
 * @returns Array of BlockChange objects
 */
export function serializeBlockChanges(events: MinecraftBlockEvent[]): BlockChange[] {
    return events.map(serializeBlockChange);
}

/**
 * Batch serialize multiple players
 *
 * @param players - Array of Minecraft player data
 * @returns Array of Player objects
 */
export function serializePlayers(players: MinecraftPlayer[]): Player[] {
    return players.map(serializePlayer);
}

/**
 * Batch serialize multiple entities
 *
 * @param entities - Array of Minecraft entity data
 * @returns Array of Entity objects
 */
export function serializeEntities(entities: MinecraftEntity[]): Entity[] {
    return entities.map(serializeEntity);
}

/**
 * Serialize a chunk block to the API format
 *
 * @param block - Minecraft chunk block data
 * @returns ChunkBlock object for API transmission
 */
export function serializeChunkBlock(block: MinecraftChunkBlock): ChunkBlock {
    // Minecraft RGBA values are in 0-1 range, convert to 0-255 for rendering
    const result: ChunkBlock = {
        x: block.x,
        y: block.y,
        z: block.z,
        type: normalizeBlockType(block.type),
        mapColor: {
            r: Math.round(block.mapColor.red * 255),
            g: Math.round(block.mapColor.green * 255),
            b: Math.round(block.mapColor.blue * 255),
            a: Math.round(block.mapColor.alpha * 255),
        },
        waterDepth: block.waterDepth,
    };
    return result;
}

/**
 * Serialize chunk data to the API format
 *
 * @param chunk - Minecraft chunk data
 * @returns ChunkData object for API transmission
 */
export function serializeChunkData(chunk: MinecraftChunkData): ChunkData {
    return {
        dimension: chunk.dimension,
        chunkX: chunk.chunkX,
        chunkZ: chunk.chunkZ,
        blocks: chunk.blocks.map(serializeChunkBlock),
    };
}

