/**
 * Type definitions specific to the behavior pack
 */

import type { Dimension, BlockChange, Player, Entity } from '@minecraft-map/shared';

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
export type { Dimension, BlockChange, Player, Entity } from '@minecraft-map/shared';
