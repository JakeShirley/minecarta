// Types
export type {
    Dimension,
    MapType,
    Position,
    Player,
    PlayerStats,
    BlockChange,
    Entity,
    ChunkData,
    ChunkBlock,
    TileCoordinates,
    WorldState,
    RGBA,
    ChatMessage,
    // Spawn types
    WorldSpawn,
    PlayerSpawn,
    WorldSpawnUpdateEvent,
    PlayerSpawnUpdateEvent,
    SpawnsStateEvent,
    // Time types
    WorldTime,
    WorldTimeUpdateEvent,
    WorldTimeStateEvent,
    // Weather types
    WeatherType,
    WorldWeather,
    WorldWeatherUpdateEvent,
    WorldWeatherStateEvent,
    // Chunk queue status types
    ChunkQueueStatus,
    ChunkQueueStatusEvent,
    // Structure types
    Structure,
    StructureExtents,
    StructureUpdateEvent,
    StructureMergedEvent,
    StructuresStateEvent,
    // WebSocket event types
    WebSocketEventBase,
    PlayerJoinEvent,
    PlayerLeaveEvent,
    PlayerUpdateEvent,
    TileUpdateEvent,
    BlockUpdateEvent,
    ChatMessageEvent,
    ChatHistoryEvent,
    WebSocketEvent,
} from './types/index.js';

// Constants
export {
    PROTOCOL_VERSION,
    API_VERSION,
    API_BASE_PATH,
    DEFAULT_PORT,
    DEFAULT_HOST,
    TILE_SIZE,
    ZOOM_LEVELS,
    BLOCKS_PER_TILE,
    DIMENSIONS,
    MAP_TYPES,
    AUTH_HEADER,
    WS_EVENTS,
} from './constants/index.js';

export type { ZoomLevel } from './constants/index.js';
