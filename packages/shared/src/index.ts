// Types
export type {
    Dimension,
    MapType,
    Position,
    Player,
    BlockChange,
    Entity,
    ChunkData,
    ChunkBlock,
    TileCoordinates,
    WorldState,
    RGBA,
    ChatMessage,
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
