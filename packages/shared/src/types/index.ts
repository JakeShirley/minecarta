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

// ==========================================
// Spawn Location Types
// ==========================================

/**
 * World spawn location (default spawn point for new players)
 */
export interface WorldSpawn {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly dimension: Dimension;
}

/**
 * Player spawn point (bed spawn location)
 */
export interface PlayerSpawn {
    readonly playerName: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly dimension: Dimension;
}

/**
 * World spawn update event
 */
export interface WorldSpawnUpdateEvent extends WebSocketEventBase {
    readonly type: 'spawn:world';
    readonly spawn: WorldSpawn;
}

/**
 * Player spawn update event
 */
export interface PlayerSpawnUpdateEvent extends WebSocketEventBase {
    readonly type: 'spawn:player';
    readonly spawn: PlayerSpawn;
}

/**
 * All spawns state event (sent on connection)
 */
export interface SpawnsStateEvent extends WebSocketEventBase {
    readonly type: 'spawn:state';
    readonly worldSpawn: WorldSpawn | null;
    readonly playerSpawns: readonly PlayerSpawn[];
}

// ==========================================
// World Time Types
// ==========================================

/**
 * World time data from Minecraft.
 *
 * Minecraft time works as follows:
 * - 1 tick = 1/20 of a real-world second
 * - 1 Minecraft day = 24000 ticks = 20 real-world minutes
 * - Time of day cycles from 0 to 23999:
 *   - 0 (6:00 AM) = Sunrise/Dawn
 *   - 1000 (7:00 AM) = Day begins
 *   - 6000 (12:00 PM) = Noon
 *   - 12000 (6:00 PM) = Sunset
 *   - 13000 (7:00 PM) = Night begins
 *   - 18000 (12:00 AM) = Midnight
 *   - 23000 (5:00 AM) = Dawn begins
 */
export interface WorldTime {
    /**
     * Time of day in ticks (0-23999).
     * 0 = sunrise (6:00 AM in Minecraft)
     */
    readonly timeOfDay: number;
    /**
     * Absolute time since world creation in ticks.
     */
    readonly absoluteTime: number;
    /**
     * Current in-game day number (0-based).
     */
    readonly day: number;
}

/**
 * World time update event - sent when time is synced from the game
 */
export interface WorldTimeUpdateEvent extends WebSocketEventBase {
    readonly type: 'time:update';
    readonly time: WorldTime;
}

/**
 * World time state event - sent when a client connects
 */
export interface WorldTimeStateEvent extends WebSocketEventBase {
    readonly type: 'time:state';
    readonly time: WorldTime | null;
}

// ==========================================
// World Weather Types
// ==========================================

/**
 * Weather types in Minecraft
 * - Clear: No precipitation, clear skies
 * - Rain: Raining (or snowing in cold biomes)
 * - Thunder: Thunderstorm with lightning
 */
export type WeatherType = 'Clear' | 'Rain' | 'Thunder';

/**
 * World weather data from Minecraft.
 */
export interface WorldWeather {
    /**
     * The current weather type.
     */
    readonly weather: WeatherType;
    /**
     * The dimension this weather applies to.
     * Weather is global but can be observed per-dimension.
     */
    readonly dimension: Dimension;
}

/**
 * World weather update event - sent when weather changes in the game
 */
export interface WorldWeatherUpdateEvent extends WebSocketEventBase {
    readonly type: 'weather:update';
    readonly weather: WorldWeather;
}

/**
 * World weather state event - sent when a client connects
 */
export interface WorldWeatherStateEvent extends WebSocketEventBase {
    readonly type: 'weather:state';
    readonly weather: WorldWeather | null;
}

// ==========================================
// Chunk Queue Status Types
// ==========================================

/**
 * Status of the chunk generation queue.
 * Sent periodically while chunks are being processed.
 */
export interface ChunkQueueStatus {
    /**
     * Number of jobs currently in the queue.
     */
    readonly queueSize: number;
    /**
     * Total number of jobs completed since processing started.
     */
    readonly completedCount: number;
    /**
     * Total number of jobs (completed + queued) for this batch.
     * Used to calculate completion percentage.
     */
    readonly totalCount: number;
    /**
     * Completion percentage (0-100).
     */
    readonly completionPercent: number;
    /**
     * Estimated time to completion in milliseconds.
     * Null if not enough data to estimate.
     */
    readonly etaMs: number | null;
    /**
     * Average time per job in milliseconds (based on recent jobs).
     * Null if not enough data to calculate.
     */
    readonly avgJobTimeMs: number | null;
    /**
     * Whether the queue processor is currently running.
     */
    readonly isProcessing: boolean;
}

/**
 * Chunk queue status update event - sent while chunks are being processed
 */
export interface ChunkQueueStatusEvent extends WebSocketEventBase {
    readonly type: 'queue:status';
    readonly status: ChunkQueueStatus;
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
    | ChatHistoryEvent
    | WorldSpawnUpdateEvent
    | PlayerSpawnUpdateEvent
    | SpawnsStateEvent
    | WorldTimeUpdateEvent
    | WorldTimeStateEvent
    | WorldWeatherUpdateEvent
    | WorldWeatherStateEvent
    | ChunkQueueStatusEvent;
