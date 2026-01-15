/**
 * Minecraft dimension types
 */
export type Dimension = 'overworld' | 'nether' | 'the_end';

/**
 * Map rendering types
 * - 'block': Standard block-color map (similar to Minecraft's map item)
 * - 'height': Grayscale height map based on Y values
 */
export type MapType = 'block' | 'height';

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
 * Optional player stats (health, hunger, armor).
 * Only sent if the server owner has enabled sendPlayerStats in the behavior pack config.
 */
export interface PlayerStats {
    /**
     * Current health points (0-20, where 20 is full health).
     * Each heart in the HUD represents 2 health points.
     */
    readonly health: number;
    /**
     * Maximum health points (typically 20, but can be higher with absorption).
     */
    readonly maxHealth: number;
    /**
     * Current hunger/food level (0-20, where 20 is full).
     * Each drumstick in the HUD represents 2 hunger points.
     */
    readonly hunger: number;
    /**
     * Current armor points (0-20).
     * Displayed as armor icons in the HUD.
     */
    readonly armor: number;
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
    /**
     * Optional player stats (health, hunger, armor).
     * Only present if the server owner has enabled sendPlayerStats.
     */
    readonly stats?: PlayerStats;
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
    readonly mapType?: MapType;
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
 * Chat message data from Minecraft
 */
export interface ChatMessage {
    readonly playerName: string;
    readonly message: string;
    readonly dimension: Dimension;
    readonly timestamp: number;
}

/**
 * Chat message event - sent when a player sends a chat message
 */
export interface ChatMessageEvent extends WebSocketEventBase {
    readonly type: 'chat:message';
    readonly chat: ChatMessage;
}

/**
 * Chat history event - sent when a client connects with recent chat messages
 */
export interface ChatHistoryEvent extends WebSocketEventBase {
    readonly type: 'chat:history';
    readonly messages: readonly ChatMessage[];
}

/**
 * Union of all WebSocket event types
 */
export type WebSocketEvent =
    | PlayerJoinEvent
    | PlayerLeaveEvent
    | PlayerUpdateEvent
    | TileUpdateEvent
    | BlockUpdateEvent
    | ChatMessageEvent
    | ChatHistoryEvent;
