/**
 * Minecraft dimension types
 */
export type Dimension = 'overworld' | 'nether' | 'the_end';

/**
 * RGBA color for map rendering
 */
export interface RGBA {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
}

/**
 * 3D position in the Minecraft world
 */
export interface Position {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/**
 * Player data received from Minecraft
 */
export interface Player {
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly dimension: Dimension;
    readonly lastSeen: number;
    /**
     * The player's PlayFab ID (persistent identifier across sessions).
     * Available when the player joined through the async join event.
     */
    readonly playfabId?: string;
}

/**
 * Block change event data
 */
export interface BlockChange {
    readonly dimension: Dimension;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly blockType: string;
    readonly previousType?: string;
    readonly player?: string;
    readonly timestamp: number;
}

/**
 * Entity data
 */
export interface Entity {
    readonly id: string;
    readonly type: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly dimension: Dimension;
}

/**
 * Chunk data for map generation
 */
export interface ChunkData {
    readonly dimension: Dimension;
    readonly chunkX: number;
    readonly chunkZ: number;
    readonly blocks: ChunkBlock[];
}

/**
 * Individual block within a chunk
 */
export interface ChunkBlock {
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
 * Tile coordinates
 */
export interface TileCoordinates {
    readonly dimension: Dimension;
    readonly zoom: number;
    readonly x: number;
    readonly z: number;
}

/**
 * World state snapshot
 */
export interface WorldState {
    readonly players: Player[];
    readonly entities: Entity[];
    readonly lastUpdated: number;
}

/**
 * Request to check if a chunk exists on the server
 */
export interface ChunkExistsRequest {
    readonly dimension: Dimension;
    readonly chunkX: number;
    readonly chunkZ: number;
}

/**
 * Response indicating if a chunk exists
 */
export interface ChunkExistsResponse {
    readonly exists: boolean;
    readonly dimension: Dimension;
    readonly chunkX: number;
    readonly chunkZ: number;
}

// ==========================================
// WebSocket Event Types
// ==========================================

/**
 * Base WebSocket event structure
 */
export interface WebSocketEventBase {
    readonly type: string;
    readonly timestamp: number;
}

/**
 * Player join event
 */
export interface PlayerJoinEvent extends WebSocketEventBase {
    readonly type: 'player:join';
    readonly player: Player;
}

/**
 * Player leave event
 */
export interface PlayerLeaveEvent extends WebSocketEventBase {
    readonly type: 'player:leave';
    readonly playerName: string;
}

/**
 * Player position update event
 */
export interface PlayerUpdateEvent extends WebSocketEventBase {
    readonly type: 'player:update';
    readonly players: Player[];
}

/**
 * Tile update event - sent when a map tile has been regenerated
 */
export interface TileUpdateEvent extends WebSocketEventBase {
    readonly type: 'tile:update';
    readonly tiles: TileCoordinates[];
}

/**
 * Block update event - sent when blocks change
 */
export interface BlockUpdateEvent extends WebSocketEventBase {
    readonly type: 'block:update';
    readonly blocks: BlockChange[];
}

/**
 * Union of all WebSocket event types
 */
export type WebSocketEvent =
    | PlayerJoinEvent
    | PlayerLeaveEvent
    | PlayerUpdateEvent
    | TileUpdateEvent
    | BlockUpdateEvent;
