/**
 * Type definitions specific to the behavior pack
 */

import type { Dimension, BlockChange, Player, Entity, PlayerStats } from '@minecarta/shared';
import { RGBA } from '@minecraft/server';

/**
 * Minecraft block event data (internal representation)
 */
export interface MinecraftBlockEvent {
    readonly dimension: Dimension;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly blockType: string;
    readonly previousType?: string;
    readonly playerName?: string;
}

/**
 * Minecraft player data (internal representation)
 */
export interface MinecraftPlayer {
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly dimension: Dimension;
    /**
     * The player's PlayFab ID (persistent identifier across sessions).
     * Captured from the async player join event.
     */
    readonly playfabId?: string;
    /**
     * Optional player stats (health, hunger, armor).
     * Only present if sendPlayerStats is enabled in config.
     */
    readonly stats?: PlayerStats;
}

/**
 * Minecraft entity data (internal representation)
 */
export interface MinecraftEntity {
    readonly id: string;
    readonly type: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly dimension: Dimension;
}

/**
 * Minecraft chunk block data for color/height maps
 */
export interface MinecraftChunkBlockColor {
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
 * Minecraft chunk block data for density maps
 */
export interface MinecraftChunkBlockDensity {
    readonly x: number;
    readonly z: number;
    /**
     * Normalized density of the Y column at this X/Z coordinate.
     * Range: 0 (empty/air) to 1 (fully solid), normalized per dimension height.
     */
    readonly density: number;
}

/**
 * Union type for chunk blocks
 */
export type MinecraftChunkBlock = MinecraftChunkBlockColor | MinecraftChunkBlockDensity;

/**
 * Minecraft chunk data (internal representation)
 */
export interface MinecraftChunkData {
    readonly dimension: Dimension;
    readonly chunkX: number;
    readonly chunkZ: number;
    readonly blocks: MinecraftChunkBlock[];
}

/**
 * API request payload types
 */
export interface BlockChangePayload {
    readonly changes: BlockChange[];
}

export interface PlayerUpdatePayload {
    readonly players: Player[];
}

export interface EntityUpdatePayload {
    readonly entities: Entity[];
}

/**
 * HTTP response from the server
 */
export interface ApiResponse {
    readonly success: boolean;
    readonly message?: string;
    readonly error?: string;
}

/**
 * Re-export shared types for convenience
 */
export type { Dimension, BlockChange, Player, Entity } from '@minecarta/shared';
